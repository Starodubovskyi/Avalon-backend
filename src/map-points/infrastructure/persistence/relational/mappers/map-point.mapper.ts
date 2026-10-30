import { MapPoint } from '../../../../domain/map-point';
import { MapPointEntity } from '../entities/map-point.entity';

export class MapPointMapper {
  static toDomain(raw: MapPointEntity): MapPoint {
    const domainEntity = new MapPoint();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    domainEntity.lat = raw.lat;
    domainEntity.lng = raw.lng;
    domainEntity.firstName = raw.firstName;
    domainEntity.lastName = raw.lastName;
    domainEntity.activity = raw.activity;
    domainEntity.phone = raw.phone;
    domainEntity.email = raw.email;
    domainEntity.address = raw.address;
    domainEntity.photoId = raw.photoId;
    domainEntity.isFavorite = raw.isFavorite;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(
    domainEntity: Omit<
      MapPoint,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
    > &
      Partial<Pick<MapPoint, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  ): MapPointEntity {
    const persistenceEntity = new MapPointEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.userId = Number(domainEntity.userId);
    persistenceEntity.lat = domainEntity.lat;
    persistenceEntity.lng = domainEntity.lng;
    persistenceEntity.firstName = domainEntity.firstName;
    persistenceEntity.lastName = domainEntity.lastName;
    persistenceEntity.activity = domainEntity.activity;
    persistenceEntity.phone = domainEntity.phone;
    persistenceEntity.email = domainEntity.email;
    persistenceEntity.address = domainEntity.address;
    persistenceEntity.photoId = domainEntity.photoId;
    persistenceEntity.isFavorite = domainEntity.isFavorite;
    if (domainEntity.createdAt) {
      persistenceEntity.createdAt = domainEntity.createdAt;
    }
    if (domainEntity.updatedAt) {
      persistenceEntity.updatedAt = domainEntity.updatedAt;
    }
    if (domainEntity.deletedAt !== undefined) {
      persistenceEntity.deletedAt = domainEntity.deletedAt ?? null;
    }
    return persistenceEntity;
  }
}
