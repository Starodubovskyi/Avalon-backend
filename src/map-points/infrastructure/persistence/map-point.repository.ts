import { EntityManager } from 'typeorm';
import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { MapPoint } from '../../domain/map-point';
import { MapPointKind } from '../../map-point.constants';

/**
 * Stored fields of a point. `logo` is write-only here: reads expose `hasLogo`.
 * Slots (bought with credits) and the email verification have their own
 * writes below.
 */
export type NewMapPoint = Omit<
  MapPoint,
  | 'id'
  | 'hasLogo'
  | 'activitySlots'
  | 'emailVerified'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
> & { logo: string | null };

/** Fields to change; undefined = keep, `logo: null` = remove the logo. */
export type MapPointPatch = DeepPartial<Omit<NewMapPoint, 'userId'>>;

export interface MapPointListFilter {
  kind?: MapPointKind;
  /** null = every point (team); a user id = public points and that user's own. */
  visibleTo: number | null;
  /** Only points owned by this user. */
  ownerId?: number;
  /** Only branches of this point. */
  parentId?: string;
  /** Only these points. */
  ids?: string[];
  limit: number;
}

/** Owner limit for a new point (viewers). */
export interface OwnerPointLimit {
  max: number;
}

/** The new parent is the point itself or one of its branches. */
export class MapPointParentCycleError extends Error {
  constructor() {
    super('A point cannot be its own parent or the parent of its parent');
    this.name = 'MapPointParentCycleError';
  }
}

/** Outcome of buying a slot: added, already at max, or the point is gone. */
export type ActivitySlotResult = 'added' | 'max' | 'notFound';

/**
 * Points are read and written by id; who may do what is decided by the
 * service (see map-point-access). userId is the owner (creator) and never
 * changes. Soft-deleted points are never returned. Favorites are personal
 * (one row per user and point).
 */
export abstract class MapPointRepository {
  /**
   * With `limit`, the owner's count is checked under a per-owner lock in the
   * same transaction as the insert: null when the owner already has `max`.
   */
  abstract create(
    data: NewMapPoint,
    limit: OwnerPointLimit | null,
  ): Promise<MapPoint | null>;

  /** Newest first. Never loads logos (only `hasLogo`). */
  abstract findAll(filter: MapPointListFilter): Promise<MapPoint[]>;

  abstract findById(id: MapPoint['id']): Promise<NullableType<MapPoint>>;

  /** The stored logo data URL; null when there is none or the point is gone. */
  abstract findLogo(id: MapPoint['id']): Promise<string | null>;

  /**
   * Under a row lock, so the email and its verification change together: a
   * different email clears emailVerifiedAt (the resend cooldown is kept).
   * A new parent is checked for cycles under a global parent lock; a cycle
   * throws MapPointParentCycleError.
   */
  abstract update(
    id: MapPoint['id'],
    payload: MapPointPatch,
  ): Promise<MapPoint | null>;

  /** Soft delete; its branches lose their parent. */
  abstract remove(id: MapPoint['id']): Promise<boolean>;

  /** The subset of `pointIds` in the user's favorites. */
  abstract findFavoriteIds(
    userId: number,
    pointIds: MapPoint['id'][],
  ): Promise<Set<MapPoint['id']>>;

  /** Idempotent. */
  abstract addFavorite(userId: number, pointId: MapPoint['id']): Promise<void>;

  /** Idempotent. */
  abstract removeFavorite(
    userId: number,
    pointId: MapPoint['id'],
  ): Promise<void>;

  /**
   * Team size per point: the owner (unless their account was soft-deleted)
   * plus active members with an active account.
   */
  abstract countTeamSizes(
    pointIds: MapPoint['id'][],
  ): Promise<Map<MapPoint['id'], number>>;

  /** +1 slot unless the point already has `max` or was deleted. */
  abstract addActivitySlot(
    id: MapPoint['id'],
    max: number,
    manager: EntityManager,
  ): Promise<ActivitySlotResult>;

  /**
   * Records that a verification email for `email` is being sent, unless one
   * was sent less than `intervalSeconds` ago or the email changed / was
   * verified meanwhile. Returns the previous send time, or null when not
   * recorded.
   */
  abstract reserveEmailVerification(
    id: MapPoint['id'],
    email: string,
    intervalSeconds: number,
  ): Promise<{ previousSentAt: Date | null } | null>;

  /** Undoes reserveEmailVerification() after a failed send. */
  abstract releaseEmailVerification(
    id: MapPoint['id'],
    previousSentAt: Date | null,
  ): Promise<void>;

  /**
   * Marks the stored email verified (idempotent), only while `email` is
   * still the stored one. false when nothing matched.
   */
  abstract markEmailVerified(
    id: MapPoint['id'],
    email: string,
  ): Promise<boolean>;
}
