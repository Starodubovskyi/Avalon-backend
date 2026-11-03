import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { NewWalletTransaction, WalletTransaction } from './domain/wallet';
import { WalletRepository } from './infrastructure/persistence/wallet.repository';
import { WalletTransactionKind } from './wallet.constants';
import { unprocessable } from '../utils/unprocessable';

/** A purchase paid with credits. */
export interface WalletCharge {
  userId: number;
  /** Price in credits (positive); the ledger row gets -price. */
  price: number;
  kind: WalletTransactionKind;
  pointId?: string | null;
  note?: string | null;
}

/**
 * The only writer of the ledger. Every balance change runs in a transaction
 * that first takes the user's wallet lock (pg_advisory_xact_lock), then reads
 * the balance, checks it and inserts — so two concurrent purchases can never
 * spend the same credits. The balance never goes below zero.
 */
@Injectable()
export class WalletLedgerService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Debits `charge.price` and runs `apply` (the thing bought) in the same
   * transaction; if `apply` throws, nothing is charged.
   * 422 { balance: "insufficient" } when the balance is lower than the price.
   */
  async spend<T>(
    charge: WalletCharge,
    apply: (manager: EntityManager) => Promise<T>,
  ): Promise<{ result: T; transaction: WalletTransaction }> {
    return this.post(
      {
        userId: charge.userId,
        amount: -charge.price,
        kind: charge.kind,
        note: charge.note ?? null,
        pointId: charge.pointId ?? null,
        createdById: charge.userId,
      },
      apply,
    );
  }

  /**
   * Credits (amount > 0) or debits (amount < 0, never below zero) a user.
   * `before` runs first in the same transaction and may throw to abort
   * (e.g. a top-up request that was handled in the meantime).
   */
  async credit(
    entry: NewWalletTransaction,
    before?: (manager: EntityManager) => Promise<void>,
  ): Promise<WalletTransaction> {
    const { transaction } = await this.post(entry, async (manager) => {
      await before?.(manager);
    });
    return transaction;
  }

  private post<T>(
    entry: NewWalletTransaction,
    apply: (manager: EntityManager) => Promise<T>,
  ): Promise<{ result: T; transaction: WalletTransaction }> {
    return this.dataSource.transaction(async (manager) => {
      await this.walletRepository.lockWallet(entry.userId, manager);
      if (entry.amount < 0) {
        const balance = await this.walletRepository.getBalance(
          entry.userId,
          manager,
        );
        if (balance + entry.amount < 0) {
          throw unprocessable('balance', 'insufficient');
        }
      }
      const result = await apply(manager);
      const transaction = await this.walletRepository.insertTransaction(
        entry,
        manager,
      );
      return { result, transaction };
    });
  }
}
