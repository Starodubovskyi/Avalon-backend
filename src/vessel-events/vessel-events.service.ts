import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import { NewVesselEvent, VesselEvent } from './domain/vessel-event';
import {
  QueryVesselEventDto,
  VESSEL_EVENTS_MAX_LIMIT,
} from './dto/query-vessel-event.dto';
import { VesselEventRepository } from './infrastructure/persistence/vessel-event.repository';

@Injectable()
export class VesselEventsService {
  constructor(
    private readonly eventRepository: VesselEventRepository,
    private readonly vesselRepository: VesselRepository,
  ) {}

  /** Must be called with the EntityManager of the vessel write transaction. */
  record(manager: EntityManager, event: NewVesselEvent): Promise<void> {
    return this.eventRepository.create(event, manager);
  }

  async findByVessel(vesselId: string): Promise<VesselEvent[]> {
    const events = await this.eventRepository.findMany({
      vesselId,
      limit: VESSEL_EVENTS_MAX_LIMIT,
    });
    // History of a (soft-)deleted vessel stays readable; an unknown id is a 404.
    if (
      events.length === 0 &&
      !(await this.vesselRepository.findById(vesselId))
    ) {
      throw new NotFoundException('Vessel not found');
    }
    return events;
  }

  findRecent(query: QueryVesselEventDto): Promise<VesselEvent[]> {
    return this.eventRepository.findMany({
      limit: query.limit ?? 100,
      before: query.before ? new Date(query.before) : undefined,
      beforeId: query.beforeId,
    });
  }
}
