import { toUserRef } from '../../../../../users/domain/user-ref';
import { MapPoint } from '../../../../domain/map-point';
import { NewMapPoint } from '../../map-point.repository';
import { MapPointEntity } from '../entities/map-point.entity';

/** Stored fields; `logo` undefined = leave the stored logo as it is. */
export type MapPointPersistenceInput = Omit<NewMapPoint, 'logo'> & {
  logo?: string | null;
} & Partial<Pick<MapPoint, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

export class MapPointMapper {
  static toDomain(raw: MapPointEntity): MapPoint {
    const domainEntity = new MapPoint();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    domainEntity.kind = raw.kind;
    domainEntity.lat = raw.lat;
    domainEntity.lng = raw.lng;
    domainEntity.firstName = raw.firstName;
    domainEntity.lastName = raw.lastName;
    domainEntity.activity = raw.activity;
    domainEntity.activities = raw.activities ?? [];
    // hasLogo is a virtual column; the fallback covers a freshly saved entity.
    domainEntity.hasLogo =
      raw.hasLogo ?? (raw.logo !== undefined && raw.logo !== null);
    domainEntity.phone = raw.phone;
    domainEntity.email = raw.email;
    domainEntity.address = raw.address;
    domainEntity.notes = raw.notes;
    domainEntity.photoId = raw.photoId;
    domainEntity.createdBy = toUserRef(raw.user);
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: MapPointPersistenceInput): MapPointEntity {
    const persistenceEntity = new MapPointEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.userId = Number(domainEntity.userId);
    persistenceEntity.kind = domainEntity.kind;
    persistenceEntity.lat = domainEntity.lat;
    persistenceEntity.lng = domainEntity.lng;
    persistenceEntity.firstName = domainEntity.firstName;
    persistenceEntity.lastName = domainEntity.lastName;
    persistenceEntity.activity = domainEntity.activity;
    persistenceEntity.activities = domainEntity.activities;
    if (domainEntity.logo !== undefined) {
      persistenceEntity.logo = domainEntity.logo;
    }
    persistenceEntity.phone = domainEntity.phone;
    persistenceEntity.email = domainEntity.email;
    persistenceEntity.address = domainEntity.address;
    persistenceEntity.notes = domainEntity.notes;
    persistenceEntity.photoId = domainEntity.photoId;
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
