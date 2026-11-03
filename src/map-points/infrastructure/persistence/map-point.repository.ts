import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { MapPoint } from '../../domain/map-point';
import { MapPointKind } from '../../map-point.constants';

/** Stored fields of a point. `logo` is write-only here: reads expose `hasLogo`. */
export type NewMapPoint = Omit<
  MapPoint,
  'id' | 'hasLogo' | 'createdBy' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { logo: string | null };

/** Fields to change; undefined = keep, `logo: null` = remove the logo. */
export type MapPointPatch = DeepPartial<Omit<NewMapPoint, 'userId'>>;

export interface MapPointListFilter {
  kind?: MapPointKind;
  limit: number;
}

/**
 * The map is shared by the whole team: reads and writes are not scoped to
 * the creator (userId). Soft-deleted points are never returned.
 * Favorites are personal (one row per user and point).
 */
export abstract class MapPointRepository {
  abstract create(data: NewMapPoint): Promise<MapPoint>;

  /** Newest first. Never loads logos (only `hasLogo`). */
  abstract findAll(filter: MapPointListFilter): Promise<MapPoint[]>;

  abstract findById(id: MapPoint['id']): Promise<NullableType<MapPoint>>;

  /** True when the point exists and is not deleted. */
  abstract exists(id: MapPoint['id']): Promise<boolean>;

  /** The stored logo data URL; null when there is none or the point is gone. */
  abstract findLogo(id: MapPoint['id']): Promise<string | null>;

  abstract update(
    id: MapPoint['id'],
    payload: MapPointPatch,
  ): Promise<MapPoint | null>;

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
}
