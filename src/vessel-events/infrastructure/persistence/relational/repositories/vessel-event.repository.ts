import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { NewVesselEvent, VesselEvent } from '../../../../domain/vessel-event';
import {
  VesselEventListFilter,
  VesselEventRepository,
} from '../../vessel-event.repository';
import { VesselEventEntity } from '../entities/vessel-event.entity';
import { VesselEventMapper } from '../mappers/vessel-event.mapper';

const CREATED_AT_MS = `date_trunc('milliseconds', "event"."createdAt")`;

@Injectable()
export class VesselEventRelationalRepository implements VesselEventRepository {
  constructor(
    @InjectRepository(VesselEventEntity)
    private readonly eventRepository: Repository<VesselEventEntity>,
  ) {}

  async create(event: NewVesselEvent, manager: EntityManager): Promise<void> {
    await manager.getRepository(VesselEventEntity).insert({
      vesselId: event.vesselId,
      vesselName: event.vesselName,
      userId: event.userId,
      action: event.action,
      changes: event.changes,
    });
  }

  async findMany(filter: VesselEventListFilter): Promise<VesselEvent[]> {
    const query = this.eventRepository
      .createQueryBuilder('event')
      // keep the author of old events visible even if the user was soft-deleted
      .withDeleted()
      .leftJoin('event.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email']);

    if (filter.vesselId) {
      query.andWhere('event.vesselId = :vesselId', {
        vesselId: filter.vesselId,
      });
    }
    // createdAt is stored with microseconds but the API returns milliseconds,
    // so the keyset (and the ordering it relies on) uses the ms-truncated value.
    if (filter.before && filter.beforeId) {
      query.andWhere(
        `(${CREATED_AT_MS}, "event"."id") < (CAST(:before AS timestamptz), CAST(:beforeId AS uuid))`,
        { before: filter.before, beforeId: filter.beforeId },
      );
    } else if (filter.before) {
      query.andWhere(`${CREATED_AT_MS} < CAST(:before AS timestamptz)`, {
        before: filter.before,
      });
    }

    const entities = await query
      .orderBy(CREATED_AT_MS, 'DESC')
      .addOrderBy('"event"."id"', 'DESC')
      .limit(filter.limit)
      .getMany();

    return entities.map((entity) => VesselEventMapper.toDomain(entity));
  }
}
