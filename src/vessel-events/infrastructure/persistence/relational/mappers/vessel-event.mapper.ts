import { toUserRef } from '../../../../../users/domain/user-ref';
import { VesselEvent } from '../../../../domain/vessel-event';
import { VesselEventEntity } from '../entities/vessel-event.entity';

export class VesselEventMapper {
  static toDomain(raw: VesselEventEntity): VesselEvent {
    const event = new VesselEvent();
    event.id = raw.id;
    event.vesselId = raw.vesselId;
    event.vesselName = raw.vesselName;
    event.action = raw.action;
    event.changes = raw.changes ?? {};
    event.user = toUserRef(raw.user);
    event.createdAt = raw.createdAt;
    return event;
  }
}
