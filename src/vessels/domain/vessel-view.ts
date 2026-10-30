import { ApiProperty } from '@nestjs/swagger';
import { UserRef } from '../../users/domain/user-ref';
import {
  CHECKLIST_KEYS,
  ChecklistKey,
  DESTINATIONS,
  Destination,
  OK_STATUSES,
  OkStatus,
  POSITION_SOURCES,
  PositionSource,
  T1_STATUSES,
  T1Status,
  VESSEL_CONDITIONS,
  VESSEL_STAGES,
  VESSEL_TYPES,
  VesselCondition,
  VesselStage,
  VesselType,
} from '../vessel.constants';

export class VesselChecklist {
  @ApiProperty({ type: Number, example: 5 })
  done: number;

  @ApiProperty({ type: Number, example: 8 })
  total: number;

  @ApiProperty({ enum: CHECKLIST_KEYS, isArray: true })
  pending: ChecklistKey[];
}

/** API representation of a vessel. Internal fields are null when restricted. */
export class VesselView {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({ type: String, example: 'MV AVALON STAR' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '9123456' })
  imo: string | null;

  @ApiProperty({ type: String, nullable: true, example: '271000123' })
  mmsi: string | null;

  @ApiProperty({ enum: VESSEL_TYPES })
  type: VesselType;

  @ApiProperty({ enum: DESTINATIONS })
  destination: Destination;

  @ApiProperty({ enum: VESSEL_CONDITIONS, nullable: true })
  condition: VesselCondition | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  etaSulina: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  arrivedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  inPortAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  departedAt: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 45.15 })
  lat: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 29.75 })
  lng: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 8.4 })
  sog: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 270 })
  cog: number | null;

  @ApiProperty({ enum: POSITION_SOURCES, nullable: true })
  positionSource: PositionSource | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  positionAt: string | null;

  @ApiProperty({ enum: VESSEL_STAGES })
  stage: VesselStage;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;

  @ApiProperty({
    type: Boolean,
    description: 'true for viewers: internal fields below are null',
  })
  restricted: boolean;

  @ApiProperty({ type: String, nullable: true })
  masterName: string | null;

  @ApiProperty({ type: String, nullable: true })
  masterPhone: string | null;

  @ApiProperty({ type: String, nullable: true })
  masterEmail: string | null;

  @ApiProperty({ type: String, nullable: true })
  officeName: string | null;

  @ApiProperty({ type: String, nullable: true })
  officePhone: string | null;

  @ApiProperty({ type: String, nullable: true })
  officeEmail: string | null;

  @ApiProperty({ type: String, nullable: true })
  portAgent: string | null;

  @ApiProperty({ enum: OK_STATUSES, nullable: true })
  prearrivalsIn: OkStatus | null;

  @ApiProperty({ enum: OK_STATUSES, nullable: true })
  prearrivalsOut: OkStatus | null;

  @ApiProperty({ type: Boolean, nullable: true })
  mswIn: boolean | null;

  @ApiProperty({ type: Boolean, nullable: true })
  mswOut: boolean | null;

  @ApiProperty({ type: Boolean, nullable: true })
  pdaSent: boolean | null;

  @ApiProperty({ type: Boolean, nullable: true })
  paid: boolean | null;

  @ApiProperty({ enum: T1_STATUSES, nullable: true })
  t1: T1Status | null;

  @ApiProperty({ type: Boolean, nullable: true })
  pilotageArranged: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  pilot: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: () => VesselChecklist, nullable: true })
  checklist: VesselChecklist | null;

  @ApiProperty({ type: Boolean, nullable: true })
  unpaidAfterDeparture: boolean | null;

  @ApiProperty({ type: () => UserRef, nullable: true })
  updatedBy: UserRef | null;
}
