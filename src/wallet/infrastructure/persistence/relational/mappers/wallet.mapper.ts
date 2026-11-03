import { toUserCard } from '../../../../../users-directory/domain/user-card';
import {
  ActiveRankBoost,
  TopUpRequest,
  WalletAccount,
  WalletTransaction,
} from '../../../../domain/wallet';
import {
  TopUpRequestStatus,
  WalletTransactionKind,
} from '../../../../wallet.constants';

export interface WalletTransactionRow {
  id: string;
  amount: number | string;
  kind: WalletTransactionKind;
  note: string | null;
  pointId: string | null;
  createdAt: Date;
  seq?: number | string;
  balanceAfter: number | string;
}

export interface TopUpRequestRow {
  id: string;
  amount: number | string;
  note: string | null;
  status: TopUpRequestStatus;
  handledAt: Date | null;
  createdAt: Date;
  userId: number | string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
}

export interface WalletAccountRow {
  id: number | string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
  balance: number | string;
}

export interface RankBoostRow {
  points: number | string;
  expiresAt: Date;
}

export class WalletMapper {
  static toTransaction(row: WalletTransactionRow): WalletTransaction {
    const transaction = new WalletTransaction();
    transaction.id = row.id;
    transaction.amount = Number(row.amount);
    transaction.kind = row.kind;
    transaction.note = row.note;
    transaction.pointId = row.pointId;
    transaction.createdAt = row.createdAt.toISOString();
    transaction.balanceAfter = Number(row.balanceAfter);
    return transaction;
  }

  static toTopUpRequest(row: TopUpRequestRow): TopUpRequest {
    const request = new TopUpRequest();
    request.id = row.id;
    request.amount = Number(row.amount);
    request.note = row.note;
    request.status = row.status;
    request.user = toUserCard({
      id: Number(row.userId),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      roleId: row.roleId,
    });
    request.handledAt = row.handledAt?.toISOString() ?? null;
    request.createdAt = row.createdAt.toISOString();
    return request;
  }

  static toAccount(row: WalletAccountRow): WalletAccount {
    const account = new WalletAccount();
    account.user = toUserCard({
      id: Number(row.id),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      roleId: row.roleId,
    });
    account.balance = Number(row.balance);
    return account;
  }

  static toBoost(row: RankBoostRow): ActiveRankBoost {
    const boost = new ActiveRankBoost();
    boost.points = Number(row.points);
    boost.expiresAt = row.expiresAt.toISOString();
    return boost;
  }
}
