import { toUserRef } from '../../../../../users/domain/user-ref';
import {
  Destination,
  VesselType,
} from '../../../../../vessels/vessel.constants';
import { AgencyRequestStatus } from '../../../../agency-requests.constants';
import { AgencyRequest } from '../../../../domain/agency-request';

/** agency_request row joined with its author (LEFT JOIN "user"). */
export interface AgencyRequestRow {
  id: string;
  status: AgencyRequestStatus;
  company: string;
  contactName: string;
  email: string;
  phone: string | null;
  vesselName: string;
  imo: string | null;
  vesselType: VesselType;
  destination: Destination;
  eta: Date | null;
  cargo: string | null;
  notes: string | null;
  staffNote: string | null;
  vesselId: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: number | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
}

export class AgencyRequestMapper {
  static toDomain(row: AgencyRequestRow): AgencyRequest {
    const request = new AgencyRequest();
    request.id = row.id;
    request.status = row.status;
    request.company = row.company;
    request.contactName = row.contactName;
    request.email = row.email;
    request.phone = row.phone;
    request.vesselName = row.vesselName;
    request.imo = row.imo;
    request.vesselType = row.vesselType;
    request.destination = row.destination;
    request.eta = row.eta?.toISOString() ?? null;
    request.cargo = row.cargo;
    request.notes = row.notes;
    request.staffNote = row.staffNote;
    request.vesselId = row.vesselId;
    request.createdBy =
      row.authorId === null
        ? null
        : toUserRef({
            id: Number(row.authorId),
            firstName: row.authorFirstName,
            lastName: row.authorLastName,
            email: row.authorEmail,
          });
    request.createdAt = row.createdAt.toISOString();
    request.updatedAt = row.updatedAt.toISOString();
    return request;
  }
}
