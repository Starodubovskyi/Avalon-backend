import { UserRef } from '../../users/domain/user-ref';
import {
  Destination,
  OkStatus,
  PositionSource,
  T1Status,
  VesselCondition,
  VesselType,
} from '../vessel.constants';

/** Full internal vessel record (never sent to clients as-is; see VesselView). */
export class Vessel {
  id: string;
  name: string;
  imo: string | null;
  mmsi: string | null;
  type: VesselType;
  destination: Destination;
  condition: VesselCondition | null;

  masterName: string | null;
  masterPhone: string | null;
  masterEmail: string | null;
  officeName: string | null;
  officePhone: string | null;
  officeEmail: string | null;
  portAgent: string | null;

  etaSulina: Date | null;
  arrivedAt: Date | null;
  inPortAt: Date | null;
  departedAt: Date | null;

  prearrivalsIn: OkStatus;
  prearrivalsOut: OkStatus;
  mswIn: boolean;
  mswOut: boolean;
  pdaSent: boolean;
  paid: boolean;
  t1: T1Status | null;
  pilotageArranged: boolean;
  pilot: string | null;
  notes: string | null;

  lat: number | null;
  lng: number | null;
  sog: number | null;
  cog: number | null;
  positionSource: PositionSource | null;
  positionAt: Date | null;

  createdById: number | null;
  updatedById: number | null;
  /** Populated by repository reads (join on user); null when unknown. */
  updatedBy: UserRef | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Writable columns of a vessel (no ids, timestamps or joined data). */
export type VesselWritable = Omit<
  Vessel,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'updatedBy'
>;

/** Lightweight projection used by the AIS matcher. */
export interface AisTrackedVessel {
  id: string;
  /** Snapshot for the audit event when AIS binds an MMSI. */
  name: string;
  imo: string | null;
  mmsi: string | null;
  /** Last stored position, used by the AIS speed-jump filter. */
  lat: number | null;
  lng: number | null;
  positionAt: Date | null;
  positionSource: PositionSource | null;
}

export interface AisPositionUpdate {
  lat: number;
  lng: number;
  sog: number | null;
  cog: number | null;
  positionAt: Date;
}
