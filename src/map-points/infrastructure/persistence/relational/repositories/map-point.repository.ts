import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { MapPointEntity } from '../entities/map-point.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MapPoint } from '../../../../domain/map-point';
import {
  MapPointListFilter,
  MapPointRepository,
  NewMapPoint,
} from '../../map-point.repository';
import { MapPointMapper } from '../mappers/map-point.mapper';
import { DeepPartial } from '../../../../../utils/types/deep-partial.type';

@Injectable()
export class MapPointRelationalRepository implements MapPointRepository {
  constructor(
    @InjectRepository(MapPointEntity)
    private readonly mapPointRepository: Repository<MapPointEntity>,
  ) {}

  /**
   * Joins the creator for `createdBy`. withDeleted() keeps the creator visible
   * after a user soft delete; deleted points are excluded explicitly.
   */
  private baseQuery(): SelectQueryBuilder<MapPointEntity> {
    return this.mapPointRepository
      .createQueryBuilder('point')
      .withDeleted()
      .leftJoin('point.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email'])
      .where('point.deletedAt IS NULL');
  }

  async create(data: NewMapPoint): Promise<MapPoint> {
    const persistenceModel = MapPointMapper.toPersistence(data);
    const newEntity = await this.mapPointRepository.save(
      this.mapPointRepository.create(persistenceModel),
    );
    return (
      (await this.findById(newEntity.id)) ?? MapPointMapper.toDomain(newEntity)
    );
  }

  async findAll(filter: MapPointListFilter): Promise<MapPoint[]> {
    const query = this.baseQuery();
    if (filter.kind) {
      query.andWhere('point.kind = :kind', { kind: filter.kind });
    }
    const entities = await query
      .orderBy('point.createdAt', 'DESC')
      .addOrderBy('point.id', 'DESC')
      // many-to-one join only: LIMIT is safe (no row multiplication)
      .limit(filter.limit)
      .getMany();
    return entities.map((entity) => MapPointMapper.toDomain(entity));
  }

  async findById(id: MapPoint['id']): Promise<NullableType<MapPoint>> {
    const entity = await this.baseQuery()
      .andWhere('point.id = :id', { id })
      .getOne();
    return entity ? MapPointMapper.toDomain(entity) : null;
  }

  async update(
    id: MapPoint['id'],
    payload: DeepPartial<MapPoint>,
  ): Promise<MapPoint | null> {
    const entity = await this.mapPointRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const current = MapPointMapper.toDomain(entity);
    const merged: MapPoint = {
      ...current,
      id,
      // the creator never changes, whoever edits the point
      userId: entity.userId,
      kind: typeof payload.kind === 'string' ? payload.kind : current.kind,
      lat: typeof payload.lat === 'number' ? payload.lat : current.lat,
      lng: typeof payload.lng === 'number' ? payload.lng : current.lng,
      firstName:
        typeof payload.firstName === 'string'
          ? payload.firstName
          : current.firstName,
      lastName:
        typeof payload.lastName === 'string'
          ? payload.lastName
          : current.lastName,
      activity:
        typeof payload.activity === 'string'
          ? payload.activity
          : current.activity,
      phone:
        payload.phone === undefined
          ? current.phone
          : payload.phone === null
            ? null
            : String(payload.phone),
      email:
        payload.email === undefined
          ? current.email
          : payload.email === null
            ? null
            : String(payload.email),
      address:
        payload.address === undefined
          ? current.address
          : payload.address === null
            ? null
            : String(payload.address),
      notes:
        payload.notes === undefined
          ? current.notes
          : payload.notes === null
            ? null
            : String(payload.notes),
      photoId:
        payload.photoId === undefined
          ? current.photoId
          : payload.photoId === null
            ? null
            : String(payload.photoId),
      isFavorite:
        typeof payload.isFavorite === 'boolean'
          ? payload.isFavorite
          : current.isFavorite,
    };

    await this.mapPointRepository.save(
      this.mapPointRepository.create(MapPointMapper.toPersistence(merged)),
    );

    return this.findById(id);
  }

  async remove(id: MapPoint['id']): Promise<boolean> {
    // softDelete() does not skip already-deleted rows; filter explicitly.
    const result = await this.mapPointRepository.update(
      { id, deletedAt: IsNull() },
      { deletedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }
}
