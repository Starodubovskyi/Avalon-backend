import { EntityManager } from 'typeorm';
import { NullableType } from '../../../utils/types/nullable.type';
import {
  AisPositionUpdate,
  AisTrackedVessel,
  Vessel,
  VesselWritable,
} from '../../domain/vessel';
import { VesselScope } from '../../vessel.constants';

export interface VesselListFilter {
  scope: VesselScope;
  search?: string;
  limit: number;
}

/**
 * Write methods take the EntityManager of the caller's transaction so the
 * vessel row and its audit event (vessel_event) commit atomically.
 */
export abstract class VesselRepository {
  abstract findAll(filter: VesselListFilter): Promise<Vessel[]>;

  abstract findById(id: Vessel['id']): Promise<NullableType<Vessel>>;

  /**
   * Reads a non-deleted vessel with a row lock (SELECT ... FOR UPDATE) inside
   * the caller's transaction, so concurrent edits serialize and the audit
   * diff is computed from the committed state. updatedBy is not joined.
   */
  abstract findByIdForUpdate(
    id: Vessel['id'],
    manager: EntityManager,
  ): Promise<NullableType<Vessel>>;

  abstract existsWithImo(
    imo: string,
    excludeId?: Vessel['id'],
  ): Promise<boolean>;

  abstract create(
    data: VesselWritable,
    manager: EntityManager,
  ): Promise<Vessel>;

  /** Returns false when the vessel no longer exists (deleted concurrently). */
  abstract update(
    id: Vessel['id'],
    patch: Partial<VesselWritable>,
    manager: EntityManager,
  ): Promise<boolean>;

  /** Returns false when the vessel no longer exists. */
  abstract softDelete(
    id: Vessel['id'],
    userId: number,
    manager: EntityManager,
  ): Promise<boolean>;

  /** Not departed, not deleted — the set AIS tries to match. */
  abstract findActiveForAis(): Promise<AisTrackedVessel[]>;

  /** Sets mmsi only when still empty. Does not touch updatedAt/updatedBy. */
  abstract assignMmsiIfEmpty(
    id: Vessel['id'],
    mmsi: string,
    manager: EntityManager,
  ): Promise<boolean>;

  /** AIS position write. Does not touch updatedAt/updatedBy, no audit event. */
  abstract updateAisPosition(
    id: Vessel['id'],
    position: AisPositionUpdate,
  ): Promise<void>;
}
