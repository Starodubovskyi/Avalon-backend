import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NetworkActor } from '../users-directory/user-visibility';
import { isUniqueViolation } from '../utils/is-unique-violation';
import { unprocessable } from '../utils/unprocessable';
import {
  TopUpRequest,
  WalletAccount,
  WalletPrices,
  WalletSummary,
  WalletTransaction,
} from './domain/wallet';
import { CreateTopUpRequestDto } from './dto/create-top-up-request.dto';
import { CreateWalletCreditDto } from './dto/create-wallet-credit.dto';
import { QueryTopUpRequestsDto } from './dto/query-top-up-requests.dto';
import { WalletRepository } from './infrastructure/persistence/wallet.repository';
import { WalletLedgerService } from './wallet-ledger.service';
import {
  RANK_BOOST,
  TOP_UP_REQUEST_LIST_LIMIT,
  WALLET_ACCOUNTS_LIMIT,
  WALLET_PRICES,
  WALLET_TRANSACTIONS_LIMIT,
} from './wallet.constants';

const PENDING_INDEX = 'UQ_top_up_request_pending';

/**
 * Wallet of the caller (balance, history, top-up requests, RANK boost) and
 * the admin side (requests, direct credits, accounts). Admin-only methods are
 * guarded by RolesGuard at the controller.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly ledger: WalletLedgerService,
  ) {}

  async getSummary(actor: NetworkActor): Promise<WalletSummary> {
    const [balance, transactions, pendingTopUp, activeBoosts] =
      await Promise.all([
        this.walletRepository.getBalance(actor.userId),
        this.walletRepository.findTransactions(
          actor.userId,
          WALLET_TRANSACTIONS_LIMIT,
        ),
        this.walletRepository.findPendingTopUpRequest(actor.userId),
        this.walletRepository.findActiveBoosts(actor.userId),
      ]);
    const summary = new WalletSummary();
    summary.balance = balance;
    summary.transactions = transactions;
    summary.prices = walletPrices();
    summary.pendingTopUp = pendingTopUp;
    summary.activeBoosts = activeBoosts;
    return summary;
  }

  /** One pending request per user: 422 { amount: "pendingExists" }. */
  async createTopUpRequest(
    actor: NetworkActor,
    dto: CreateTopUpRequestDto,
  ): Promise<TopUpRequest> {
    if (await this.walletRepository.findPendingTopUpRequest(actor.userId)) {
      throw this.pendingExists();
    }
    let id: string;
    try {
      id = await this.walletRepository.createTopUpRequest({
        userId: actor.userId,
        amount: dto.amount,
        note: dto.note ?? null,
      });
    } catch (error) {
      // Two simultaneous submits: the partial unique index keeps one.
      if (isUniqueViolation(error, PENDING_INDEX)) {
        throw this.pendingExists();
      }
      throw error;
    }
    return this.getTopUpRequestOrFail(id);
  }

  findTopUpRequests(query: QueryTopUpRequestsDto): Promise<TopUpRequest[]> {
    return this.walletRepository.findTopUpRequests({
      status: query.status,
      limit: TOP_UP_REQUEST_LIST_LIMIT,
    });
  }

  /**
   * pending → approved and the credit commit together; a second click finds
   * the request handled: 422 { status: "alreadyHandled" }, nothing credited.
   */
  async approveTopUpRequest(
    id: string,
    admin: NetworkActor,
  ): Promise<TopUpRequest> {
    const request = await this.getTopUpRequestOrFail(id);
    if (request.status !== 'pending') {
      throw this.alreadyHandled();
    }
    await this.ledger.credit(
      {
        userId: request.user.id,
        amount: request.amount,
        kind: 'top_up',
        note: 'Top-up request approved',
        pointId: null,
        createdById: admin.userId,
      },
      async (manager) => {
        if (
          !(await this.walletRepository.handleTopUpRequest(
            id,
            'approved',
            admin.userId,
            manager,
          ))
        ) {
          throw this.alreadyHandled();
        }
      },
    );
    return this.getTopUpRequestOrFail(id);
  }

  async declineTopUpRequest(
    id: string,
    admin: NetworkActor,
  ): Promise<TopUpRequest> {
    const request = await this.getTopUpRequestOrFail(id);
    if (
      request.status !== 'pending' ||
      !(await this.walletRepository.handleTopUpRequest(
        id,
        'declined',
        admin.userId,
      ))
    ) {
      throw this.alreadyHandled();
    }
    return this.getTopUpRequestOrFail(id);
  }

  /** Direct credit (kind top_up) or, for a negative amount, an adjustment. */
  async credit(
    dto: CreateWalletCreditDto,
    admin: NetworkActor,
  ): Promise<WalletTransaction> {
    if (!(await this.walletRepository.userExists(dto.userId))) {
      throw unprocessable('userId', 'notFound');
    }
    return this.ledger.credit({
      userId: dto.userId,
      amount: dto.amount,
      kind: dto.amount > 0 ? 'top_up' : 'adjustment',
      note: dto.note ?? null,
      pointId: null,
      createdById: admin.userId,
    });
  }

  findAccounts(search: string | undefined): Promise<WalletAccount[]> {
    return this.walletRepository.findAccounts(search, WALLET_ACCOUNTS_LIMIT);
  }

  /** -100 credits → +250 RANK for 30 days (boosts stack). */
  async boostRank(actor: NetworkActor): Promise<WalletSummary> {
    await this.ledger.spend(
      {
        userId: actor.userId,
        price: WALLET_PRICES.rankBoost,
        kind: 'rank_boost',
        note: `+${RANK_BOOST.points} RANK for ${RANK_BOOST.days} days`,
      },
      (manager) =>
        this.walletRepository.insertRankBoost(
          actor.userId,
          RANK_BOOST.points,
          RANK_BOOST.days,
          manager,
        ),
    );
    return this.getSummary(actor);
  }

  private async getTopUpRequestOrFail(id: string): Promise<TopUpRequest> {
    const request = await this.walletRepository.findTopUpRequest(id);
    if (!request) {
      throw new NotFoundException('Top-up request not found');
    }
    return request;
  }

  private pendingExists(): UnprocessableEntityException {
    return unprocessable('amount', 'pendingExists');
  }

  private alreadyHandled(): UnprocessableEntityException {
    return unprocessable('status', 'alreadyHandled');
  }
}

export function walletPrices(): WalletPrices {
  const prices = new WalletPrices();
  prices.activitySlot = WALLET_PRICES.activitySlot;
  prices.rankBoost = WALLET_PRICES.rankBoost;
  prices.rankBoostPoints = RANK_BOOST.points;
  prices.rankBoostDays = RANK_BOOST.days;
  return prices;
}
