import { Port } from '../../../../domain/port';
import { PortOperationalStatus } from '../../../../port-status.enum';
import { PortEntity } from '../entities/port.entity';

export class PortMapper {
  static toDomain(raw: PortEntity): Port {
    const domainEntity = new Port();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.unlocode = raw.unlocode;
    domainEntity.country = raw.country;
    domainEntity.status = raw.status;
    domainEntity.timezone = raw.timezone;
    domainEntity.lat = raw.lat;
    domainEntity.lng = raw.lng;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(
    domainEntity: Omit<Port, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> &
      Partial<Pick<Port, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  ): PortEntity {
    const persistenceEntity = new PortEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.unlocode = domainEntity.unlocode;
    persistenceEntity.country = domainEntity.country;
    persistenceEntity.status =
      domainEntity.status ?? PortOperationalStatus.OPEN;
    persistenceEntity.timezone = domainEntity.timezone;
    persistenceEntity.lat = domainEntity.lat;
    persistenceEntity.lng = domainEntity.lng;
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
