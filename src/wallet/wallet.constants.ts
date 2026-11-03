/** Virtual credits (1 credit ≈ €1, no real payments). */
export const WALLET_PRICES = { activitySlot: 50, rankBoost: 100 } as const;
export const RANK_BOOST = { points: 250, days: 30 } as const;

export const WALLET_TRANSACTION_KINDS = [
  'top_up',
  'activity_slot',
  'rank_boost',
  'refund',
  'adjustment',
] as const;
export type WalletTransactionKind = (typeof WALLET_TRANSACTION_KINDS)[number];

export const TOP_UP_REQUEST_STATUSES = [
  'pending',
  'approved',
  'declined',
] as const;
export type TopUpRequestStatus = (typeof TOP_UP_REQUEST_STATUSES)[number];

export const TOP_UP_AMOUNT = { min: 1, max: 100_000 } as const;
/** Admin credit / adjustment: any non-zero amount in this range. */
export const CREDIT_AMOUNT_LIMIT = 100_000;
export const TOP_UP_NOTE_MAX_LENGTH = 300;
export const WALLET_NOTE_MAX_LENGTH = 200;

/** Latest transactions in WalletSummary. */
export const WALLET_TRANSACTIONS_LIMIT = 50;
export const TOP_UP_REQUEST_LIST_LIMIT = 200;
export const WALLET_ACCOUNTS_LIMIT = 100;
