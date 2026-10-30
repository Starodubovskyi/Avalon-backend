import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapPointEntity } from '../entities/map-point.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MapPoint } from '../../../../domain/map-point';
import { MapPointRepository } from '../../map-point.repository';
import { MapPointMapper } from '../mappers/map-point.mapper';
import { DeepPartial } from '../../../../../utils/types/deep-partial.type';
import { User } from '../../../../../users/domain/user';

@Injectable()
export class MapPointRelationalRepository implements MapPointRepository {
  constructor(
    @InjectRepository(MapPointEntity)
    private readonly mapPointRepository: Repository<MapPointEntity>,
  ) {}

  async create(
    data: Omit<MapPoint, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<MapPoint> {
    const persistenceModel = MapPointMapper.toPersistence(data);
    const newEntity = await this.mapPointRepository.save(
      this.mapPointRepository.create(persistenceModel),
    );
    return MapPointMapper.toDomain(newEntity);
  }

  async findAllByUserId(userId: User['id']): Promise<MapPoint[]> {
    const entities = await this.mapPointRepository.find({
      where: { userId: Number(userId) },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return entities.map((entity) => MapPointMapper.toDomain(entity));
  }

  async findByIdForUser(
    id: MapPoint['id'],
    userId: User['id'],
  ): Promise<NullableType<MapPoint>> {
    const entity = await this.mapPointRepository.findOne({
      where: { id, userId: Number(userId) },
    });
    return entity ? MapPointMapper.toDomain(entity) : null;
  }

  async updateForUser(
    id: MapPoint['id'],
    userId: User['id'],
    payload: DeepPartial<MapPoint>,
  ): Promise<MapPoint | null> {
    const entity = await this.mapPointRepository.findOne({
      where: { id, userId: Number(userId) },
    });

    if (!entity) {
      return null;
    }

    const current = MapPointMapper.toDomain(entity);
    const merged: MapPoint = {
      ...current,
      id,
      userId: entity.userId,
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

    const updatedEntity = await this.mapPointRepository.save(
      this.mapPointRepository.create(MapPointMapper.toPersistence(merged)),
    );

    return MapPointMapper.toDomain(updatedEntity);
  }

  async removeForUser(
    id: MapPoint['id'],
    userId: User['id'],
  ): Promise<boolean> {
    const entity = await this.mapPointRepository.findOne({
      where: { id, userId: Number(userId) },
    });
    if (!entity) {
      return false;
    }
    await this.mapPointRepository.softDelete({ id, userId: Number(userId) });
    return true;
  }
}
