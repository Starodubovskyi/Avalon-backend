import { toUserRef } from '../../../../../users/domain/user-ref';
import { Vessel, VesselWritable } from '../../../../domain/vessel';
import { VesselEntity } from '../entities/vessel.entity';

export class VesselMapper {
  static toDomain(raw: VesselEntity): Vessel {
    const vessel = new Vessel();
    vessel.id = raw.id;
    vessel.name = raw.name;
    vessel.imo = raw.imo;
    vessel.mmsi = raw.mmsi;
    vessel.type = raw.type;
    vessel.destination = raw.destination;
    vessel.condition = raw.condition;
    vessel.masterName = raw.masterName;
    vessel.masterPhone = raw.masterPhone;
    vessel.masterEmail = raw.masterEmail;
    vessel.officeName = raw.officeName;
    vessel.officePhone = raw.officePhone;
    vessel.officeEmail = raw.officeEmail;
    vessel.portAgent = raw.portAgent;
    vessel.etaSulina = raw.etaSulina;
    vessel.arrivedAt = raw.arrivedAt;
    vessel.inPortAt = raw.inPortAt;
    vessel.departedAt = raw.departedAt;
    vessel.prearrivalsIn = raw.prearrivalsIn;
    vessel.prearrivalsOut = raw.prearrivalsOut;
    vessel.mswIn = raw.mswIn;
    vessel.mswOut = raw.mswOut;
    vessel.pdaSent = raw.pdaSent;
    vessel.paid = raw.paid;
    vessel.t1 = raw.t1;
    vessel.pilotageArranged = raw.pilotageArranged;
    vessel.pilot = raw.pilot;
    vessel.notes = raw.notes;
    vessel.lat = raw.lat;
    vessel.lng = raw.lng;
    vessel.sog = raw.sog;
    vessel.cog = raw.cog;
    vessel.positionSource = raw.positionSource;
    vessel.positionAt = raw.positionAt;
    vessel.createdById = raw.createdById;
    vessel.updatedById = raw.updatedById;
    vessel.updatedBy = toUserRef(raw.updatedBy);
    vessel.createdAt = raw.createdAt;
    vessel.updatedAt = raw.updatedAt;
    vessel.deletedAt = raw.deletedAt;
    return vessel;
  }

  static toPersistence(data: Partial<VesselWritable>): Partial<VesselEntity> {
    // Explicit copy keeps unknown keys (e.g. joined data) out of INSERT/UPDATE.
    const entity: Partial<VesselEntity> = {};
    const assign = <K extends keyof VesselWritable>(key: K) => {
      if (data[key] !== undefined) {
        (entity as Partial<VesselWritable>)[key] = data[key];
      }
    };
    assign('name');
    assign('imo');
    assign('mmsi');
    assign('type');
    assign('destination');
    assign('condition');
    assign('masterName');
    assign('masterPhone');
    assign('masterEmail');
    assign('officeName');
    assign('officePhone');
    assign('officeEmail');
    assign('portAgent');
    assign('etaSulina');
    assign('arrivedAt');
    assign('inPortAt');
    assign('departedAt');
    assign('prearrivalsIn');
    assign('prearrivalsOut');
    assign('mswIn');
    assign('mswOut');
    assign('pdaSent');
    assign('paid');
    assign('t1');
    assign('pilotageArranged');
    assign('pilot');
    assign('notes');
    assign('lat');
    assign('lng');
    assign('sog');
    assign('cog');
    assign('positionSource');
    assign('positionAt');
    assign('createdById');
    assign('updatedById');
    return entity;
  }
}
