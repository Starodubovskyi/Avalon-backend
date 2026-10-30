import { EntityManager } from 'typeorm';
import { NewVesselEvent, VesselEvent } from '../../domain/vessel-event';

export interface VesselEventListFilter {
  vesselId?: string;
  /** Keyset cursor: createdAt (ms precision, as returned by the API)... */
  before?: Date;
  /** ...and id of the last event of the previous page. */
  beforeId?: string;
  limit: number;
}

export abstract class VesselEventRepository {
  /** Inserts inside the caller's transaction (same EntityManager as the vessel write). */
  abstract create(event: NewVesselEvent, manager: EntityManager): Promise<void>;

  /** Newest first. */
  abstract findMany(filter: VesselEventListFilter): Promise<VesselEvent[]>;
}
