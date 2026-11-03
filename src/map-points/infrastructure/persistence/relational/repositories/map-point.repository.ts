import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { MapPointEntity } from '../entities/map-point.entity';
import { MapPointFavoriteEntity } from '../entities/map-point-favorite.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MapPoint } from '../../../../domain/map-point';
import { pointVisibleToSql } from '../../../../../users-directory/infrastructure/persistence/relational/user-visibility-sql';
import {
  ActivitySlotResult,
  MapPointListFilter,
  MapPointParentCycleError,
  MapPointPatch,
  MapPointRepository,
  NewMapPoint,
  OwnerPointLimit,
} from '../../map-point.repository';
import { MapPointMapper } from '../mappers/map-point.mapper';
import { mergeMapPointPatch } from '../mappers/map-point-patch';

@Injectable()
export class MapPointRelationalRepository implements MapPointRepository {
  constructor(
    @InjectRepository(MapPointEntity)
    private readonly mapPointRepository: Repository<MapPointEntity>,
    @InjectRepository(MapPointFavoriteEntity)
    private readonly favoriteRepository: Repository<MapPointFavoriteEntity>,
  ) {}

  /**
   * Joins the creator for `createdBy`. withDeleted() keeps the creator visible
   * after a user soft delete; deleted points are excluded explicitly.
   * `logo` is a select: false column: only the virtual `hasLogo` is read.
   */
  private baseQuery(): SelectQueryBuilder<MapPointEntity> {
    return (
      this.mapPointRepository
        .createQueryBuilder('point')
        .withDeleted()
        .leftJoin('point.user', 'user')
        .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email'])
        // the creator's role decides whether viewers see the email
        .leftJoin('user.role', 'role')
        .addSelect(['role.id'])
        .where('point.deletedAt IS NULL')
    );
  }

  async create(
    data: NewMapPoint,
    limit: OwnerPointLimit | null,
  ): Promise<MapPoint | null> {
    const persistenceModel = MapPointMapper.toPersistence(data);
    const newId = await this.mapPointRepository.manager.transaction(
      async (manager) => {
        if (limit) {
          // Per-owner lock: two parallel creates cannot both pass the count.
          await manager.query(
            `SELECT pg_advisory_xact_lock(hashtext('map_point.owner'), $1)`,
            [persistenceModel.userId],
          );
          const [row]: { count: number | string }[] = await manager.query(
            `SELECT COUNT(*)::int AS "count" FROM "map_point"
             WHERE "userId" = $1 AND "deletedAt" IS NULL`,
            [persistenceModel.userId],
          );
          if (Number(row?.count ?? 0) >= limit.max) {
            return null;
          }
        }
        const repository = manager.getRepository(MapPointEntity);
        const saved = await repository.save(
          repository.create(persistenceModel),
        );
        return saved.id;
      },
    );
    return newId ? this.findById(newId) : null;
  }

  async findAll(filter: MapPointListFilter): Promise<MapPoint[]> {
    if (filter.ids !== undefined && filter.ids.length === 0) {
      return [];
    }
    const query = this.baseQuery();
    if (filter.kind) {
      query.andWhere('point.kind = :kind', { kind: filter.kind });
    }
    if (filter.visibleTo !== null) {
      query.andWhere(pointVisibleToSql('point', ':visibleTo'), {
        visibleTo: filter.visibleTo,
      });
    }
    if (filter.ownerId !== undefined) {
      query.andWhere('point.userId = :ownerId', { ownerId: filter.ownerId });
    }
    if (filter.parentId !== undefined) {
      query.andWhere('point.parentId = :parentId', {
        parentId: filter.parentId,
      });
    }
    if (filter.ids !== undefined) {
      query.andWhere('point.id IN (:...ids)', { ids: filter.ids });
    }
    const entities = await query
      .orderBy('point.createdAt', 'DESC')
      .addOrderBy('point.id', 'DESC')
      // many-to-one join only: LIMIT is safe (no row multiplication)
      .limit(filter.limit)
      .getMany();
    return entities.map((entity) => MapPointMapper.toDomain(entity));
  }

  async findById(id: MapPoint['id']): Promise<NullableType<MapPoint>> {
    const entity = await this.baseQuery()
      .andWhere('point.id = :id', { id })
      .getOne();
    return entity ? MapPointMapper.toDomain(entity) : null;
  }

  async findLogo(id: MapPoint['id']): Promise<string | null> {
    const row = await this.mapPointRepository
      .createQueryBuilder('point')
      .select('point.logo', 'logo')
      .where('point.id = :id', { id })
      .andWhere('point.deletedAt IS NULL')
      .getRawOne<{ logo: string | null }>();
    return row?.logo ?? null;
  }

  async update(
    id: MapPoint['id'],
    payload: MapPointPatch,
  ): Promise<MapPoint | null> {
    const found = await this.mapPointRepository.manager.transaction(
      async (manager) => {
        if (typeof payload.parentId === 'string') {
          // One parent change at a time: two crossing changes (A under B,
          // B under A) cannot both pass the cycle check.
          await manager.query(
            `SELECT pg_advisory_xact_lock(hashtext('map_point.parent'), 0)`,
          );
          if (
            payload.parentId === id ||
            (await this.findAncestorIds(payload.parentId, manager)).includes(id)
          ) {
            throw new MapPointParentCycleError();
          }
        }
        const repository = manager.getRepository(MapPointEntity);
        // Row lock until commit: a link confirmed meanwhile cannot leave the
        // new email verified (save() skips columns it sees unchanged).
        const entity = await repository.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!entity) {
          return false;
        }
        const current = MapPointMapper.toDomain(entity);
        const merged = mergeMapPointPatch(current, entity.userId, payload);
        const toSave = repository.create(
          MapPointMapper.toPersistence({ ...merged, id }),
        );
        // The verification belongs to an email value; the resend cooldown
        // (emailVerificationSentAt) is kept so changing emails cannot bypass it.
        if (merged.email !== current.email) {
          toSave.emailVerifiedAt = null;
        }
        await repository.save(toSave);
        return true;
      },
    );
    return found ? this.findById(id) : null;
  }

  async remove(id: MapPoint['id']): Promise<boolean> {
    return this.mapPointRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(MapPointEntity);
      // softDelete() does not skip already-deleted rows; filter explicitly.
      const result = await repository.update(
        { id, deletedAt: IsNull() },
        { deletedAt: new Date() },
      );
      if ((result.affected ?? 0) === 0) {
        return false;
      }
      // Like ON DELETE SET NULL for a hard delete.
      await repository.update({ parentId: id }, { parentId: null });
      return true;
    });
  }

  /** Ids of the point's parent, grandparent, … (nearest first). */
  private async findAncestorIds(
    id: MapPoint['id'],
    manager: EntityManager,
  ): Promise<MapPoint['id'][]> {
    // Depth-limited: a corrupt cycle cannot loop forever.
    const rows: { id: string }[] = await manager.query(
      `WITH RECURSIVE ancestors("id", "depth") AS (
         SELECT p."parentId", 1 FROM "map_point" p
         WHERE p."id" = $1 AND p."parentId" IS NOT NULL
         UNION ALL
         SELECT p."parentId", a."depth" + 1 FROM "map_point" p
         JOIN ancestors a ON p."id" = a."id"
         WHERE p."parentId" IS NOT NULL AND a."depth" < 50
       )
       SELECT "id" FROM ancestors ORDER BY "depth"`,
      [id],
    );
    return rows.map((row) => row.id);
  }

  async findFavoriteIds(
    userId: number,
    pointIds: MapPoint['id'][],
  ): Promise<Set<MapPoint['id']>> {
    if (pointIds.length === 0) {
      return new Set();
    }
    const rows = await this.favoriteRepository.find({
      select: { pointId: true },
      where: { userId, pointId: In(pointIds) },
    });
    return new Set(rows.map((row) => row.pointId));
  }

  async addFavorite(userId: number, pointId: MapPoint['id']): Promise<void> {
    await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .into(MapPointFavoriteEntity)
      .values({ userId, pointId })
      .orIgnore()
      .execute();
  }

  async removeFavorite(userId: number, pointId: MapPoint['id']): Promise<void> {
    await this.favoriteRepository.delete({ userId, pointId });
  }

  async countTeamSizes(
    pointIds: MapPoint['id'][],
  ): Promise<Map<MapPoint['id'], number>> {
    if (pointIds.length === 0) {
      return new Map();
    }
    const rows: { pointId: string; size: number | string }[] =
      await this.mapPointRepository.query(
        `SELECT p."id" AS "pointId",
           (CASE WHEN o."deletedAt" IS NULL THEN 1 ELSE 0 END)
           + (SELECT COUNT(*)::int FROM "company_member" m
              JOIN "user" u ON u."id" = m."userId" AND u."deletedAt" IS NULL
              WHERE m."pointId" = p."id" AND m."status" = 'active') AS "size"
         FROM "map_point" p
         JOIN "user" o ON o."id" = p."userId"
         WHERE p."id" = ANY($1::uuid[])`,
        [pointIds],
      );
    return new Map(rows.map((row) => [row.pointId, Number(row.size)]));
  }

  async addActivitySlot(
    id: MapPoint['id'],
    max: number,
    manager: EntityManager,
  ): Promise<ActivitySlotResult> {
    // FOR UPDATE + conditional UPDATE: tells "at max" from "deleted".
    const [row]: { found: number | string; added: number | string }[] =
      await manager.query(
        `WITH target AS (
           SELECT "id", "activitySlots" FROM "map_point"
           WHERE "id" = $1 AND "deletedAt" IS NULL
           FOR UPDATE
         ), added AS (
           UPDATE "map_point" p SET "activitySlots" = p."activitySlots" + 1
           FROM target
           WHERE p."id" = target."id" AND target."activitySlots" < $2
           RETURNING p."id"
         )
         SELECT (SELECT COUNT(*) FROM target)::int AS "found",
                (SELECT COUNT(*) FROM added)::int AS "added"`,
        [id, max],
      );
    if (Number(row?.found ?? 0) === 0) {
      return 'notFound';
    }
    return Number(row.added) > 0 ? 'added' : 'max';
  }

  async reserveEmailVerification(
    id: MapPoint['id'],
    email: string,
    intervalSeconds: number,
  ): Promise<{ previousSentAt: Date | null } | null> {
    // FOR UPDATE: parallel sends for one point queue up, and the second one
    // sees the first one's timestamp.
    const [row]: { previousSentAt: Date | null }[] =
      await this.mapPointRepository.query(
        `WITH previous AS (
           SELECT "id", "emailVerificationSentAt" AS "sentAt" FROM "map_point"
           WHERE "id" = $1 AND "deletedAt" IS NULL
           FOR UPDATE
         ), reserved AS (
           UPDATE "map_point" p SET "emailVerificationSentAt" = now()
           FROM previous
           WHERE p."id" = previous."id" AND p."email" = $2
             AND p."emailVerifiedAt" IS NULL
             AND (previous."sentAt" IS NULL
                  OR previous."sentAt" <= now() - make_interval(secs => $3::int))
           RETURNING previous."sentAt" AS "previousSentAt"
         )
         SELECT "previousSentAt" FROM reserved`,
        [id, email, intervalSeconds],
      );
    return row ? { previousSentAt: row.previousSentAt } : null;
  }

  async releaseEmailVerification(
    id: MapPoint['id'],
    previousSentAt: Date | null,
  ): Promise<void> {
    await this.mapPointRepository.update(
      { id },
      { emailVerificationSentAt: previousSentAt },
    );
  }

  async markEmailVerified(id: MapPoint['id'], email: string): Promise<boolean> {
    const rows: { id: string }[] = await this.mapPointRepository.query(
      `WITH verified AS (
         UPDATE "map_point"
         SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", now())
         WHERE "id" = $1 AND "deletedAt" IS NULL AND "email" = $2
         RETURNING "id"
       )
       SELECT "id" FROM verified`,
      [id, email],
    );
    return rows.length > 0;
  }
}
