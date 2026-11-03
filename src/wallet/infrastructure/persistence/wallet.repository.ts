import { EntityManager } from 'typeorm';
import { NullableType } from '../../../utils/types/nullable.type';
import {
  ActiveRankBoost,
  NewWalletTransaction,
  TopUpRequest,
  WalletAccount,
  WalletTransaction,
} from '../../domain/wallet';
import { TopUpRequestStatus } from '../../wallet.constants';

export interface NewTopUpRequest {
  userId: number;
  amount: number;
  note: string | null;
}

export interface TopUpRequestListFilter {
  status?: TopUpRequestStatus;
  limit: number;
}

/**
 * Credits ledger (insert-only; balance = sum), top-up requests and RANK
 * boosts. Writes that must commit together take the EntityManager of the
 * caller's transaction.
 */
export abstract class WalletRepository {
  /**
   * Transaction-scoped advisory lock on the user's wallet: balance checks and
   * inserts of concurrent requests for one user run one after another.
   */
  abstract lockWallet(userId: number, manager: EntityManager): Promise<void>;

  abstract getBalance(userId: number, manager?: EntityManager): Promise<number>;

  /** Returns the new row with balanceAfter. */
  abstract insertTransaction(
    data: NewWalletTransaction,
    manager: EntityManager,
  ): Promise<WalletTransaction>;

  /** Newest first, each with the running balance after it. */
  abstract findTransactions(
    userId: number,
    limit: number,
  ): Promise<WalletTransaction[]>;

  abstract insertRankBoost(
    userId: number,
    points: number,
    days: number,
    manager: EntityManager,
  ): Promise<void>;

  /** Not yet expired, soonest expiry first. */
  abstract findActiveBoosts(userId: number): Promise<ActiveRankBoost[]>;

  /** Throws a unique violation (UQ_top_up_request_pending) when one is pending. */
  abstract createTopUpRequest(data: NewTopUpRequest): Promise<string>;

  abstract findTopUpRequest(id: string): Promise<NullableType<TopUpRequest>>;

  abstract findPendingTopUpRequest(
    userId: number,
  ): Promise<NullableType<TopUpRequest>>;

  /** Newest first. */
  abstract findTopUpRequests(
    filter: TopUpRequestListFilter,
  ): Promise<TopUpRequest[]>;

  /**
   * pending → approved/declined in one conditional UPDATE: false when the
   * request does not exist or was already handled (double click).
   */
  abstract handleTopUpRequest(
    id: string,
    status: Exclude<TopUpRequestStatus, 'pending'>,
    handledById: number,
    manager?: EntityManager,
  ): Promise<boolean>;

  /** Active (not deleted) users with their balance, alphabetical. */
  abstract findAccounts(
    search: string | undefined,
    limit: number,
  ): Promise<WalletAccount[]>;

  /** True for an existing, not deleted user. */
  abstract userExists(userId: number): Promise<boolean>;
}
