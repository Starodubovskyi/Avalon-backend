import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  EntityManager,
  IsNull,
  Not,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { escapeLikePattern } from '../../../../../utils/escape-like';
import {
  AisPositionUpdate,
  AisTrackedVessel,
  Vessel,
  VesselWritable,
} from '../../../../domain/vessel';
import { VesselListFilter, VesselRepository } from '../../vessel.repository';
import { VesselEntity } from '../entities/vessel.entity';
import { VesselMapper } from '../mappers/vessel.mapper';

@Injectable()
export class VesselRelationalRepository implements VesselRepository {
  constructor(
    @InjectRepository(VesselEntity)
    private readonly vesselRepository: Repository<VesselEntity>,
  ) {}

  /**
   * withDeleted() keeps the author visible even if the user was soft-deleted;
   * soft-deleted vessels are excluded explicitly.
   */
  private baseQuery(): SelectQueryBuilder<VesselEntity> {
    return this.vesselRepository
      .createQueryBuilder('vessel')
      .withDeleted()
      .leftJoin('vessel.updatedBy', 'updatedBy')
      .addSelect([
        'updatedBy.id',
        'updatedBy.firstName',
        'updatedBy.lastName',
        'updatedBy.email',
      ])
      .where('vessel.deletedAt IS NULL');
  }

  async findAll(filter: VesselListFilter): Promise<Vessel[]> {
    const query = this.baseQuery();

    if (filter.scope === 'active') {
      query.andWhere('vessel.departedAt IS NULL');
    } else if (filter.scope === 'departed') {
      query.andWhere('vessel.departedAt IS NOT NULL');
    }

    const search = filter.search?.trim();
    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`;
      query.andWhere(
        new Brackets((where) => {
          where
            .where('vessel.name ILIKE :pattern', { pattern })
            .orWhere('vessel.imo ILIKE :pattern', { pattern });
        }),
      );
    }

    // Not departed first (by ETA, then arrival), departed afterwards (latest first).
    query
      .orderBy(
        'CASE WHEN "vessel"."departedAt" IS NULL THEN 0 ELSE 1 END',
        'ASC',
      )
      .addOrderBy(
        'CASE WHEN "vessel"."departedAt" IS NULL THEN COALESCE("vessel"."etaSulina", "vessel"."arrivedAt") END',
        'ASC',
        'NULLS LAST',
      )
      .addOrderBy('vessel.departedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('vessel.name', 'ASC')
      // many-to-one join only: LIMIT is safe (no row multiplication)
      .limit(filter.limit);

    const entities = await query.getMany();
    return entities.map((entity) => VesselMapper.toDomain(entity));
  }

  async findById(id: Vessel['id']): Promise<NullableType<Vessel>> {
    const entity = await this.baseQuery()
      .andWhere('vessel.id = :id', { id })
      .getOne();
    return entity ? VesselMapper.toDomain(entity) : null;
  }

  async findByIdForUpdate(
    id: Vessel['id'],
    manager: EntityManager,
  ): Promise<NullableType<Vessel>> {
    // No joins: FOR UPDATE cannot lock the nullable side of an outer join.
    const entity = await manager.getRepository(VesselEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return entity ? VesselMapper.toDomain(entity) : null;
  }

  existsWithImo(imo: string, excludeId?: Vessel['id']): Promise<boolean> {
    return this.vesselRepository.exists({
      where: {
        imo,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
  }

  async create(data: VesselWritable, manager: EntityManager): Promise<Vessel> {
    const repository = manager.getRepository(VesselEntity);
    const saved = await repository.save(
      repository.create(VesselMapper.toPersistence(data)),
    );
    return VesselMapper.toDomain(saved);
  }

  async update(
    id: Vessel['id'],
    patch: Partial<VesselWritable>,
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .getRepository(VesselEntity)
      .update({ id, deletedAt: IsNull() }, VesselMapper.toPersistence(patch));
    return (result.affected ?? 0) > 0;
  }

  async softDelete(
    id: Vessel['id'],
    userId: number,
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .getRepository(VesselEntity)
      .update(
        { id, deletedAt: IsNull() },
        { updatedById: userId, deletedAt: new Date() },
      );
    return (result.affected ?? 0) > 0;
  }

  async findActiveForAis(): Promise<AisTrackedVessel[]> {
    const entities = await this.vesselRepository.find({
      select: {
        id: true,
        imo: true,
        mmsi: true,
        lat: true,
        lng: true,
        positionAt: true,
        positionSource: true,
        name: true,
      },
      where: { departedAt: IsNull() },
    });
    return entities.map((entity) => ({
      id: entity.id,
      imo: entity.imo,
      mmsi: entity.mmsi,
      lat: entity.lat,
      lng: entity.lng,
      positionAt: entity.positionAt,
      positionSource: entity.positionSource,
      name: entity.name,
    }));
  }

  async assignMmsiIfEmpty(
    id: Vessel['id'],
    mmsi: string,
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .getRepository(VesselEntity)
      .createQueryBuilder()
      .update(VesselEntity)
      // Setting updatedAt to itself stops TypeORM from bumping it (AIS is not an edit).
      .set({ mmsi, updatedAt: () => '"updatedAt"' })
      .where('"id" = :id AND "mmsi" IS NULL AND "deletedAt" IS NULL', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async updateAisPosition(
    id: Vessel['id'],
    position: AisPositionUpdate,
  ): Promise<void> {
    await this.vesselRepository
      .createQueryBuilder()
      .update(VesselEntity)
      .set({
        lat: position.lat,
        lng: position.lng,
        sog: position.sog,
        cog: position.cog,
        positionAt: position.positionAt,
        positionSource: 'ais',
        updatedAt: () => '"updatedAt"',
      })
      .where('"id" = :id AND "deletedAt" IS NULL', { id })
      .execute();
  }
}
