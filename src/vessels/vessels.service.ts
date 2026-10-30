import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { VesselEventChanges } from '../vessel-events/domain/vessel-event';
import { VesselEventsService } from '../vessel-events/vessel-events.service';
import { Vessel, VesselWritable } from './domain/vessel';
import { VesselView } from './domain/vessel-view';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { QueryVesselDto } from './dto/query-vessel.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import { VesselRepository } from './infrastructure/persistence/vessel.repository';
import {
  buildNewVessel,
  diffVesselFields,
  findIncompletePositionField,
  pickEditableFields,
  toCreatedChanges,
  toFieldValue,
  VesselEditableValues,
} from './vessel-changes';
import { VESSEL_LIST_LIMIT } from './vessel.constants';
import { toVesselView } from './vessel-presenter';

export interface VesselActor {
  userId: number;
  roleId: number | string | null | undefined;
}

const IMO_UNIQUE_INDEX = 'UQ_vessel_imo_active';

@Injectable()
export class VesselsService {
  constructor(
    private readonly vesselRepository: VesselRepository,
    private readonly vesselEventsService: VesselEventsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryVesselDto,
    roleId: VesselActor['roleId'],
  ): Promise<VesselView[]> {
    const vessels = await this.vesselRepository.findAll({
      scope: query.scope ?? 'all',
      search: query.search,
      limit: VESSEL_LIST_LIMIT,
    });
    return vessels.map((vessel) => toVesselView(vessel, roleId));
  }

  async findById(
    id: Vessel['id'],
    roleId: VesselActor['roleId'],
  ): Promise<VesselView> {
    return toVesselView(await this.getOrFail(id), roleId);
  }

  async create(dto: CreateVesselDto, actor: VesselActor): Promise<VesselView> {
    const values = pickEditableFields(dto);
    this.assertPositionComplete(values.lat ?? null, values.lng ?? null);
    if (values.imo) {
      await this.assertImoAvailable(values.imo);
    }

    const data = buildNewVessel(
      {
        ...values,
        name: dto.name,
        type: dto.type,
        destination: dto.destination,
      },
      actor.userId,
      new Date(),
    );

    const created = await this.withImoConflictMapping(() =>
      this.dataSource.transaction(async (manager) => {
        const vessel = await this.vesselRepository.create(data, manager);
        await this.vesselEventsService.record(manager, {
          vesselId: vessel.id,
          vesselName: vessel.name,
          userId: actor.userId,
          action: 'created',
          changes: toCreatedChanges(values),
        });
        return vessel;
      }),
    );

    return this.findById(created.id, actor.roleId);
  }

  async update(
    id: Vessel['id'],
    dto: UpdateVesselDto,
    actor: VesselActor,
  ): Promise<VesselView> {
    const requested = pickEditableFields(dto);

    await this.withImoConflictMapping(() =>
      this.dataSource.transaction(async (manager) => {
        // Locked read: concurrent edits of the same vessel serialize here, so
        // the diff ("from") is always taken from the latest committed row.
        const current = await this.getForUpdateOrFail(id, manager);
        const changes = diffVesselFields(current, requested);
        if (Object.keys(changes).length === 0) {
          return; // nothing changed: no write, no audit event
        }

        const patch = this.pickChanged(requested, changes);
        if (changes.lat || changes.lng) {
          this.applyManualPosition(current, patch, changes);
        }
        if (changes.imo && patch.imo) {
          await this.assertImoAvailable(patch.imo, id);
        }
        patch.updatedById = actor.userId;

        if (!(await this.vesselRepository.update(id, patch, manager))) {
          throw new NotFoundException('Vessel not found');
        }
        await this.vesselEventsService.record(manager, {
          vesselId: id,
          vesselName: patch.name ?? current.name,
          userId: actor.userId,
          action: 'updated',
          changes,
        });
      }),
    );

    return this.findById(id, actor.roleId);
  }

  async remove(id: Vessel['id'], userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const current = await this.getForUpdateOrFail(id, manager);
      if (!(await this.vesselRepository.softDelete(id, userId, manager))) {
        throw new NotFoundException('Vessel not found');
      }
      await this.vesselEventsService.record(manager, {
        vesselId: id,
        vesselName: current.name,
        userId,
        action: 'deleted',
        changes: {},
      });
    });
  }

  private async getForUpdateOrFail(
    id: Vessel['id'],
    manager: EntityManager,
  ): Promise<Vessel> {
    const vessel = await this.vesselRepository.findByIdForUpdate(id, manager);
    if (!vessel) {
      throw new NotFoundException('Vessel not found');
    }
    return vessel;
  }

  private async getOrFail(id: Vessel['id']): Promise<Vessel> {
    const vessel = await this.vesselRepository.findById(id);
    if (!vessel) {
      throw new NotFoundException('Vessel not found');
    }
    return vessel;
  }

  private pickChanged(
    requested: Partial<VesselEditableValues>,
    changes: VesselEventChanges,
  ): Partial<VesselWritable> {
    const patch: Partial<Record<keyof VesselEditableValues, unknown>> = {};
    for (const field of Object.keys(
      changes,
    ) as (keyof VesselEditableValues)[]) {
      patch[field] = requested[field];
    }
    return patch as Partial<VesselWritable>;
  }

  /**
   * A user-set coordinate makes the position manual (AIS speed/course no
   * longer apply); clearing both coordinates clears the position source.
   */
  private applyManualPosition(
    current: Vessel,
    patch: Partial<VesselWritable>,
    changes: VesselEventChanges,
  ): void {
    const lat = patch.lat !== undefined ? patch.lat : current.lat;
    const lng = patch.lng !== undefined ? patch.lng : current.lng;
    this.assertPositionComplete(lat, lng);

    const hasPosition = lat !== null && lng !== null;
    patch.positionSource = hasPosition ? 'manual' : null;
    patch.positionAt = hasPosition ? new Date() : null;
    patch.sog = null;
    patch.cog = null;

    if (current.positionSource !== patch.positionSource) {
      changes.positionSource = {
        from: toFieldValue(current.positionSource),
        to: toFieldValue(patch.positionSource),
      };
    }
  }

  private assertPositionComplete(lat: number | null, lng: number | null) {
    const missing = findIncompletePositionField(lat, lng);
    if (missing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { [missing]: 'latLngRequiredTogether' },
      });
    }
  }

  private async assertImoAvailable(
    imo: string,
    excludeId?: Vessel['id'],
  ): Promise<void> {
    if (await this.vesselRepository.existsWithImo(imo, excludeId)) {
      throw this.imoAlreadyExists();
    }
  }

  /** Race-safe fallback: the partial unique index rejects a concurrent duplicate. */
  private async withImoConflictMapping<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error, IMO_UNIQUE_INDEX)) {
        throw this.imoAlreadyExists();
      }
      throw error;
    }
  }

  private imoAlreadyExists(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { imo: 'imoAlreadyExists' },
    });
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return driverError.code === '23505' && driverError.constraint === constraint;
}
