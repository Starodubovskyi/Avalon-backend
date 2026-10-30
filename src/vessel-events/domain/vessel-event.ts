import { ApiProperty } from '@nestjs/swagger';
import { UserRef } from '../../users/domain/user-ref';

export const VESSEL_EVENT_ACTIONS = ['created', 'updated', 'deleted'] as const;
export type VesselEventAction = (typeof VESSEL_EVENT_ACTIONS)[number];

/** JSON-safe field value stored in the audit diff (dates as ISO strings). */
export type VesselFieldValue = string | number | boolean | null;

export interface VesselFieldChange {
  from: VesselFieldValue;
  to: VesselFieldValue;
}

export type VesselEventChanges = Record<string, VesselFieldChange>;

export interface NewVesselEvent {
  vesselId: string;
  vesselName: string;
  userId: number | null;
  action: VesselEventAction;
  changes: VesselEventChanges;
}

/** Audit record; also the API shape (VesselEventView). */
export class VesselEvent {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  vesselId: string;

  @ApiProperty({ type: String, example: 'MV AVALON STAR' })
  vesselName: string;

  @ApiProperty({ enum: VESSEL_EVENT_ACTIONS })
  action: VesselEventAction;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { from: {}, to: {} },
    },
    example: { pdaSent: { from: false, to: true } },
  })
  changes: VesselEventChanges;

  @ApiProperty({ type: () => UserRef, nullable: true })
  user: UserRef | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
