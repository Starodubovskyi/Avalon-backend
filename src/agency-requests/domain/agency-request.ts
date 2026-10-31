import { ApiProperty } from '@nestjs/swagger';
import { UserRef } from '../../users/domain/user-ref';
import {
  DESTINATIONS,
  Destination,
  VESSEL_TYPES,
  VesselType,
} from '../../vessels/vessel.constants';
import {
  AGENCY_REQUEST_STATUSES,
  AgencyRequestStatus,
} from '../agency-requests.constants';

/** API representation of an agency request. */
export class AgencyRequest {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ enum: AGENCY_REQUEST_STATUSES, example: 'new' })
  status: AgencyRequestStatus;

  @ApiProperty({ type: String, example: 'Danube Shipping Ltd' })
  company: string;

  @ApiProperty({ type: String, example: 'Anna Petrenko' })
  contactName: string;

  @ApiProperty({ type: String, example: 'ops@danube-shipping.example' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: '+380 48 000 0000' })
  phone: string | null;

  @ApiProperty({
    type: String,
    example: 'MV AVALON STAR',
    description: 'Stored upper-cased',
  })
  vesselName: string;

  @ApiProperty({ type: String, nullable: true, example: '9123456' })
  imo: string | null;

  @ApiProperty({ enum: VESSEL_TYPES })
  vesselType: VesselType;

  @ApiProperty({ enum: DESTINATIONS })
  destination: Destination;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'ETA Sulina',
  })
  eta: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Wheat, 5 000 t' })
  cargo: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Agent's answer, visible to the client",
  })
  staffNote: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Vessel on the board once accepted',
  })
  vesselId: string | null;

  @ApiProperty({ type: () => UserRef, nullable: true })
  createdBy: UserRef | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;
}

/** Values of a new request; createdById always comes from the JWT. */
export interface NewAgencyRequest {
  createdById: number;
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
}

/** Team-only changes (PATCH); absent keys are left untouched. */
export interface AgencyRequestPatch {
  status?: AgencyRequestStatus;
  staffNote?: string | null;
  vesselId?: string | null;
}
