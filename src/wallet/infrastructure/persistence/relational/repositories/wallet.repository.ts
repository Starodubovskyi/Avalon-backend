import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  toUserSearchPattern,
  userOrderBy,
  userSearchCondition,
} from '../../../../../users-directory/infrastructure/persistence/relational/user-search';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import {
  ActiveRankBoost,
  NewWalletTransaction,
  TopUpRequest,
  WalletAccount,
  WalletTransaction,
} from '../../../../domain/wallet';
import { TopUpRequestStatus } from '../../../../wallet.constants';
import {
  NewTopUpRequest,
  TopUpRequestListFilter,
  WalletRepository,
} from '../../wallet.repository';
import {
  RankBoostRow,
  TopUpRequestRow,
  WalletAccountRow,
  WalletMapper,
  WalletTransactionRow,
} from '../mappers/wallet.mapper';

// LEFT JOIN without a deletedAt filter keeps the author of a soft-deleted user.
const SELECT_TOP_UP_REQUESTS = `SELECT r."id", r."amount", r."note", r."status", r."handledAt",
         r."createdAt", r."userId", u."firstName", u."lastName", u."email", u."roleId"
  FROM "top_up_request" r
  LEFT JOIN "user" u ON u."id" = r."userId"`;

/** Running balance in ledger order (`seq`, assigned under the wallet lock). */
const BALANCE_AFTER = `SUM(t."amount") OVER (ORDER BY t."seq" ROWS UNBOUNDED PRECEDING)`;

@Injectable()
export class WalletRelationalRepository implements WalletRepository {
  constructor(private readonly dataSource: DataSource) {}

  async lockWallet(userId: number, manager: EntityManager): Promise<void> {
    // Two-key form in the "wallet" namespace: no clash with other locks.
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtext('wallet'), $1::int)`,
      [userId],
    );
  }

  async getBalance(userId: number, manager?: EntityManager): Promise<number> {
    const [row]: { balance: number | string }[] = await (
      manager ?? this.dataSource.manager
    ).query(
      `SELECT COALESCE(SUM("amount"), 0)::int AS "balance"
       FROM "wallet_transaction" WHERE "userId" = $1`,
      [userId],
    );
    return Number(row?.balance ?? 0);
  }

  async insertTransaction(
    data: NewWalletTransaction,
    manager: EntityManager,
  ): Promise<WalletTransaction> {
    // Under the wallet lock: `seq` follows the order of balance checks;
    // clock_timestamp() records when the row was really written.
    const [row]: WalletTransactionRow[] = await manager.query(
      `WITH t AS (
         INSERT INTO "wallet_transaction"
           ("userId", "amount", "kind", "note", "pointId", "createdById", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())
         RETURNING "id", "amount", "kind", "note", "pointId", "createdAt"
       )
       SELECT t.*, (SELECT COALESCE(SUM(w."amount"), 0)::int
                    FROM "wallet_transaction" w WHERE w."userId" = $1) + t."amount" AS "balanceAfter"
       FROM t`,
      [
        data.userId,
        data.amount,
        data.kind,
        data.note,
        data.pointId,
        data.createdById,
      ],
    );
    return WalletMapper.toTransaction(row);
  }

  async findTransactions(
    userId: number,
    limit: number,
  ): Promise<WalletTransaction[]> {
    const rows: WalletTransactionRow[] = await this.dataSource.query(
      `SELECT x.* FROM (
         SELECT t."id", t."amount", t."kind", t."note", t."pointId", t."createdAt",
                t."seq", ${BALANCE_AFTER}::int AS "balanceAfter"
         FROM "wallet_transaction" t
         WHERE t."userId" = $1
       ) x
       ORDER BY x."seq" DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((row) => WalletMapper.toTransaction(row));
  }

  async insertRankBoost(
    userId: number,
    points: number,
    days: number,
    manager: EntityManager,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO "rank_boost" ("userId", "points", "expiresAt")
       VALUES ($1, $2, now() + make_interval(days => $3::int))`,
      [userId, points, days],
    );
  }

  async findActiveBoosts(userId: number): Promise<ActiveRankBoost[]> {
    const rows: RankBoostRow[] = await this.dataSource.query(
      `SELECT "points", "expiresAt" FROM "rank_boost"
       WHERE "userId" = $1 AND "expiresAt" > now()
       ORDER BY "expiresAt" ASC`,
      [userId],
    );
    return rows.map((row) => WalletMapper.toBoost(row));
  }

  async createTopUpRequest(data: NewTopUpRequest): Promise<string> {
    const [row]: { id: string }[] = await this.dataSource.query(
      `INSERT INTO "top_up_request" ("userId", "amount", "note")
       VALUES ($1, $2, $3) RETURNING "id"`,
      [data.userId, data.amount, data.note],
    );
    return row.id;
  }

  async findTopUpRequest(id: string): Promise<NullableType<TopUpRequest>> {
    const [row]: TopUpRequestRow[] = await this.dataSource.query(
      `${SELECT_TOP_UP_REQUESTS} WHERE r."id" = $1`,
      [id],
    );
    return row ? WalletMapper.toTopUpRequest(row) : null;
  }

  async findPendingTopUpRequest(
    userId: number,
  ): Promise<NullableType<TopUpRequest>> {
    const [row]: TopUpRequestRow[] = await this.dataSource.query(
      `${SELECT_TOP_UP_REQUESTS} WHERE r."userId" = $1 AND r."status" = 'pending'`,
      [userId],
    );
    return row ? WalletMapper.toTopUpRequest(row) : null;
  }

  async findTopUpRequests(
    filter: TopUpRequestListFilter,
  ): Promise<TopUpRequest[]> {
    const params = new SqlParams();
    const where = filter.status
      ? `WHERE r."status" = ${params.add(filter.status)}`
      : '';
    const rows: TopUpRequestRow[] = await this.dataSource.query(
      `${SELECT_TOP_UP_REQUESTS} ${where}
       ORDER BY r."createdAt" DESC, r."id" DESC
       LIMIT ${params.add(filter.limit)}`,
      params.values,
    );
    return rows.map((row) => WalletMapper.toTopUpRequest(row));
  }

  async handleTopUpRequest(
    id: string,
    status: Exclude<TopUpRequestStatus, 'pending'>,
    handledById: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    // The CTE makes the driver return the RETURNING rows of the UPDATE.
    const rows: { id: string }[] = await (
      manager ?? this.dataSource.manager
    ).query(
      `WITH handled AS (
         UPDATE "top_up_request"
         SET "status" = $2, "handledById" = $3, "handledAt" = now(), "updatedAt" = now()
         WHERE "id" = $1 AND "status" = 'pending'
         RETURNING "id"
       )
       SELECT "id" FROM handled`,
      [id, status, handledById],
    );
    return rows.length > 0;
  }

  async findAccounts(
    search: string | undefined,
    limit: number,
  ): Promise<WalletAccount[]> {
    const params = new SqlParams();
    const where = ['u."deletedAt" IS NULL'];
    const pattern = toUserSearchPattern(search);
    if (pattern) {
      where.push(userSearchCondition('u', params.add(pattern)));
    }
    const rows: WalletAccountRow[] = await this.dataSource.query(
      `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId",
         (SELECT COALESCE(SUM(t."amount"), 0)::int FROM "wallet_transaction" t
          WHERE t."userId" = u."id") AS "balance"
       FROM "user" u
       WHERE ${where.join(' AND ')}
       ORDER BY ${userOrderBy('u')}
       LIMIT ${params.add(limit)}`,
      params.values,
    );
    return rows.map((row) => WalletMapper.toAccount(row));
  }

  async userExists(userId: number): Promise<boolean> {
    const [row]: { exists: boolean }[] = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM "user" WHERE "id" = $1 AND "deletedAt" IS NULL) AS "exists"`,
      [userId],
    );
    return Boolean(row?.exists);
  }
}
