import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PortEntity } from '../entities/port.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Port } from '../../../../domain/port';
import { PortListFilter, PortRepository } from '../../port.repository';
import { PortMapper } from '../mappers/port.mapper';
import { DeepPartial } from '../../../../../utils/types/deep-partial.type';
import { PortOperationalStatus } from '../../../../port-status.enum';

@Injectable()
export class PortRelationalRepository implements PortRepository {
  constructor(
    @InjectRepository(PortEntity)
    private readonly portRepository: Repository<PortEntity>,
  ) {}

  async create(
    data: Omit<Port, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Port> {
    const persistenceModel = PortMapper.toPersistence(data);
    const newEntity = await this.portRepository.save(
      this.portRepository.create(persistenceModel),
    );
    return PortMapper.toDomain(newEntity);
  }

  async findAll(filter: PortListFilter): Promise<Port[]> {
    const where: Array<Record<string, unknown>> = [];
    const search = filter.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      where.push(
        { name: ILike(pattern) },
        { unlocode: ILike(pattern) },
        { country: ILike(pattern) },
      );
    }

    const entities = await this.portRepository.find({
      where:
        where.length > 0
          ? where.map((clause) =>
              filter.status ? { ...clause, status: filter.status } : clause,
            )
          : filter.status
            ? { status: filter.status }
            : {},
      order: { name: 'ASC' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    });

    return entities.map((entity) => PortMapper.toDomain(entity));
  }

  async findById(id: Port['id']): Promise<NullableType<Port>> {
    const entity = await this.portRepository.findOne({
      where: { id },
    });
    return entity ? PortMapper.toDomain(entity) : null;
  }

  async findByUnlocode(unlocode: string): Promise<NullableType<Port>> {
    const entity = await this.portRepository.findOne({
      where: { unlocode },
    });
    return entity ? PortMapper.toDomain(entity) : null;
  }

  async update(
    id: Port['id'],
    payload: DeepPartial<Port>,
  ): Promise<Port | null> {
    const entity = await this.portRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const current = PortMapper.toDomain(entity);
    const merged: Port = {
      ...current,
      id,
      name: typeof payload.name === 'string' ? payload.name : current.name,
      unlocode:
        typeof payload.unlocode === 'string'
          ? payload.unlocode
          : current.unlocode,
      country:
        payload.country === undefined
          ? current.country
          : payload.country === null
            ? null
            : String(payload.country),
      status:
        payload.status === PortOperationalStatus.OPEN ||
        payload.status === PortOperationalStatus.CONGESTED ||
        payload.status === PortOperationalStatus.CLOSED
          ? payload.status
          : current.status,
      timezone:
        typeof payload.timezone === 'string'
          ? payload.timezone
          : current.timezone,
      lat:
        payload.lat === undefined
          ? current.lat
          : payload.lat === null
            ? null
            : Number(payload.lat),
      lng:
        payload.lng === undefined
          ? current.lng
          : payload.lng === null
            ? null
            : Number(payload.lng),
    };

    const updatedEntity = await this.portRepository.save(
      this.portRepository.create(PortMapper.toPersistence(merged)),
    );

    return PortMapper.toDomain(updatedEntity);
  }

  async remove(id: Port['id']): Promise<boolean> {
    const entity = await this.portRepository.findOne({
      where: { id },
    });
    if (!entity) {
      return false;
    }
    await this.portRepository.softDelete({ id });
    return true;
  }
}
