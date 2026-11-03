import { ApiProperty } from '@nestjs/swagger';
import { UserCard } from '../../users-directory/domain/user-card';
import {
  TOP_UP_REQUEST_STATUSES,
  TopUpRequestStatus,
  WALLET_TRANSACTION_KINDS,
  WalletTransactionKind,
} from '../wallet.constants';

/** One ledger row (insert-only); credits are positive, spending negative. */
export class WalletTransaction {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: Number, example: -50 })
  amount: number;

  @ApiProperty({ enum: WALLET_TRANSACTION_KINDS, example: 'activity_slot' })
  kind: WalletTransactionKind;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  pointId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    type: Number,
    example: 450,
    description: 'Balance right after this transaction',
  })
  balanceAfter: number;
}

export class TopUpRequest {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: Number, example: 500 })
  amount: number;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ enum: TOP_UP_REQUEST_STATUSES, example: 'pending' })
  status: TopUpRequestStatus;

  @ApiProperty({ type: () => UserCard, description: 'Who asked for credits' })
  user: UserCard;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  handledAt: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

export class WalletPrices {
  @ApiProperty({ type: Number, example: 50 })
  activitySlot: number;

  @ApiProperty({ type: Number, example: 100 })
  rankBoost: number;

  @ApiProperty({ type: Number, example: 250 })
  rankBoostPoints: number;

  @ApiProperty({ type: Number, example: 30 })
  rankBoostDays: number;
}

export class ActiveRankBoost {
  @ApiProperty({ type: Number, example: 250 })
  points: number;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: string;
}

export class WalletSummary {
  @ApiProperty({ type: Number, example: 450 })
  balance: number;

  @ApiProperty({
    type: () => [WalletTransaction],
    description: 'Latest 50, newest first',
  })
  transactions: WalletTransaction[];

  @ApiProperty({ type: () => WalletPrices })
  prices: WalletPrices;

  @ApiProperty({ type: () => TopUpRequest, nullable: true })
  pendingTopUp: TopUpRequest | null;

  @ApiProperty({ type: () => [ActiveRankBoost] })
  activeBoosts: ActiveRankBoost[];
}

export class WalletAccount {
  @ApiProperty({ type: () => UserCard })
  user: UserCard;

  @ApiProperty({ type: Number, example: 450 })
  balance: number;
}

/** A ledger row to insert. */
export interface NewWalletTransaction {
  userId: number;
  amount: number;
  kind: WalletTransactionKind;
  note: string | null;
  pointId: string | null;
  createdById: number | null;
}
