import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { MapPoint } from '../../domain/map-point';
import { MapPointKind } from '../../map-point.constants';

export type NewMapPoint = Omit<
  MapPoint,
  'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface MapPointListFilter {
  kind?: MapPointKind;
  limit: number;
}

/**
 * The map is shared by the whole team: reads and writes are not scoped to
 * the creator (userId). Soft-deleted points are never returned.
 */
export abstract class MapPointRepository {
  abstract create(data: NewMapPoint): Promise<MapPoint>;

  /** Newest first. */
  abstract findAll(filter: MapPointListFilter): Promise<MapPoint[]>;

  abstract findById(id: MapPoint['id']): Promise<NullableType<MapPoint>>;

  abstract update(
    id: MapPoint['id'],
    payload: DeepPartial<MapPoint>,
  ): Promise<MapPoint | null>;

  abstract remove(id: MapPoint['id']): Promise<boolean>;
}
