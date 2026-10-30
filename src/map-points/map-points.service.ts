import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { UpdateMapPointDto } from './dto/update-map-point.dto';
import { QueryMapPointDto } from './dto/query-map-point.dto';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import { MapPoint } from './domain/map-point';
import { User } from '../users/domain/user';
import { FilesService } from '../files/files.service';
import {
  DEFAULT_MAP_POINT_KIND,
  MAP_POINT_LIST_LIMIT,
} from './map-point.constants';

/**
 * Shared team map (admin/staff): any staff member can read, edit and delete
 * any point; userId always stays the creator.
 */
@Injectable()
export class MapPointsService {
  constructor(
    private readonly mapPointRepository: MapPointRepository,
    private readonly filesService: FilesService,
  ) {}

  async create(
    userId: User['id'],
    createMapPointDto: CreateMapPointDto,
  ): Promise<MapPoint> {
    const photoId = await this.resolvePhotoId(createMapPointDto.photoId);

    return this.mapPointRepository.create({
      userId,
      kind: createMapPointDto.kind ?? DEFAULT_MAP_POINT_KIND,
      lat: createMapPointDto.lat,
      lng: createMapPointDto.lng,
      firstName: createMapPointDto.firstName,
      lastName: createMapPointDto.lastName ?? '',
      activity: createMapPointDto.activity ?? '',
      phone: createMapPointDto.phone ?? null,
      email: createMapPointDto.email ?? null,
      address: createMapPointDto.address ?? null,
      notes: createMapPointDto.notes ?? null,
      photoId,
      isFavorite: false,
    });
  }

  findAll(query: QueryMapPointDto): Promise<MapPoint[]> {
    return this.mapPointRepository.findAll({
      kind: query.kind,
      limit: MAP_POINT_LIST_LIMIT,
    });
  }

  async findById(id: MapPoint['id']): Promise<MapPoint> {
    const point = await this.mapPointRepository.findById(id);
    if (!point) {
      throw new NotFoundException('Map point not found');
    }
    return point;
  }

  async update(
    id: MapPoint['id'],
    updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPoint> {
    const photoId =
      updateMapPointDto.photoId === undefined
        ? undefined
        : await this.resolvePhotoId(updateMapPointDto.photoId);

    const updated = await this.mapPointRepository.update(id, {
      ...(updateMapPointDto.kind !== undefined
        ? { kind: updateMapPointDto.kind }
        : {}),
      ...(updateMapPointDto.lat !== undefined
        ? { lat: updateMapPointDto.lat }
        : {}),
      ...(updateMapPointDto.lng !== undefined
        ? { lng: updateMapPointDto.lng }
        : {}),
      ...(updateMapPointDto.firstName !== undefined
        ? { firstName: updateMapPointDto.firstName }
        : {}),
      ...(updateMapPointDto.lastName !== undefined
        ? { lastName: updateMapPointDto.lastName }
        : {}),
      ...(updateMapPointDto.activity !== undefined
        ? { activity: updateMapPointDto.activity }
        : {}),
      ...(updateMapPointDto.phone !== undefined
        ? { phone: updateMapPointDto.phone }
        : {}),
      ...(updateMapPointDto.email !== undefined
        ? { email: updateMapPointDto.email }
        : {}),
      ...(updateMapPointDto.address !== undefined
        ? { address: updateMapPointDto.address }
        : {}),
      ...(updateMapPointDto.notes !== undefined
        ? { notes: updateMapPointDto.notes }
        : {}),
      ...(photoId !== undefined ? { photoId } : {}),
      ...(updateMapPointDto.isFavorite !== undefined
        ? { isFavorite: updateMapPointDto.isFavorite }
        : {}),
    });

    if (!updated) {
      throw new NotFoundException('Map point not found');
    }
    return updated;
  }

  async remove(id: MapPoint['id']): Promise<void> {
    const removed = await this.mapPointRepository.remove(id);
    if (!removed) {
      throw new NotFoundException('Map point not found');
    }
  }

  private async resolvePhotoId(
    photoId: string | undefined,
  ): Promise<string | null> {
    if (!photoId) {
      return null;
    }
    const file = await this.filesService.findById(photoId);
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          photoId: 'fileNotExists',
        },
      });
    }
    return file.id;
  }
}
