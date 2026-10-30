import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { User } from '../../../users/domain/user';
import { MapPoint } from '../../domain/map-point';

export abstract class MapPointRepository {
  abstract create(
    data: Omit<MapPoint, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<MapPoint>;

  abstract findAllByUserId(userId: User['id']): Promise<MapPoint[]>;

  abstract findByIdForUser(
    id: MapPoint['id'],
    userId: User['id'],
  ): Promise<NullableType<MapPoint>>;

  abstract updateForUser(
    id: MapPoint['id'],
    userId: User['id'],
    payload: DeepPartial<MapPoint>,
  ): Promise<MapPoint | null>;

  abstract removeForUser(
    id: MapPoint['id'],
    userId: User['id'],
  ): Promise<boolean>;
}
