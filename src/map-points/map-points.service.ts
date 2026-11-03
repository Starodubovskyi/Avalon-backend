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
import {
  MapPointFavoriteState,
  MapPointLogo,
  MapPointView,
  toMapPointView,
} from './domain/map-point-view';
import { User } from '../users/domain/user';
import { FilesService } from '../files/files.service';
import { UserRankService } from '../user-rank/user-rank.service';
import { decodeImageDataUrl } from '../utils/validators/is-image-data-url';
import {
  ActivityCode,
  DEFAULT_MAP_POINT_KIND,
  FREE_ACTIVITIES_LIMIT,
  MAP_POINT_LIST_LIMIT,
  MAP_POINT_LOGO_MIME_TYPES,
} from './map-point.constants';

/**
 * Shared team map (admin/staff): any staff member can read, edit and delete
 * any point; userId always stays the creator. Favorites are per user; the
 * view carries the caller's `isFavorite` and the creator's `rank`. Logos are
 * never part of the view: `hasLogo`/`logoVersion` point to getLogo().
 */
@Injectable()
export class MapPointsService {
  constructor(
    private readonly mapPointRepository: MapPointRepository,
    private readonly filesService: FilesService,
    private readonly userRankService: UserRankService,
  ) {}

  async create(
    userId: User['id'],
    createMapPointDto: CreateMapPointDto,
  ): Promise<MapPointView> {
    const activities = this.assertActivitiesAllowed(
      createMapPointDto.activities ?? [],
    );
    const photoId = await this.resolvePhotoId(createMapPointDto.photoId);

    const point = await this.mapPointRepository.create({
      userId,
      kind: createMapPointDto.kind ?? DEFAULT_MAP_POINT_KIND,
      lat: createMapPointDto.lat,
      lng: createMapPointDto.lng,
      firstName: createMapPointDto.firstName,
      lastName: createMapPointDto.lastName ?? '',
      activity: createMapPointDto.activity ?? '',
      activities,
      logo: createMapPointDto.logo ?? null,
      phone: createMapPointDto.phone ?? null,
      email: createMapPointDto.email ?? null,
      address: createMapPointDto.address ?? null,
      notes: createMapPointDto.notes ?? null,
      photoId,
    });
    return this.presentOne(userId, point);
  }

  async findAll(
    viewerId: User['id'],
    query: QueryMapPointDto,
  ): Promise<MapPointView[]> {
    const points = await this.mapPointRepository.findAll({
      kind: query.kind,
      limit: MAP_POINT_LIST_LIMIT,
    });
    return this.present(viewerId, points);
  }

  async findById(
    viewerId: User['id'],
    id: MapPoint['id'],
  ): Promise<MapPointView> {
    const point = await this.mapPointRepository.findById(id);
    if (!point) {
      throw this.notFound();
    }
    return this.presentOne(viewerId, point);
  }

  async update(
    viewerId: User['id'],
    id: MapPoint['id'],
    updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPointView> {
    if (updateMapPointDto.activities !== undefined) {
      this.assertActivitiesAllowed(updateMapPointDto.activities);
    }
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
      ...(updateMapPointDto.activities !== undefined
        ? { activities: updateMapPointDto.activities }
        : {}),
      ...(updateMapPointDto.logo !== undefined
        ? { logo: updateMapPointDto.logo }
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
    });

    if (!updated) {
      throw this.notFound();
    }
    return this.presentOne(viewerId, updated);
  }

  async remove(id: MapPoint['id']): Promise<void> {
    const removed = await this.mapPointRepository.remove(id);
    if (!removed) {
      throw this.notFound();
    }
  }

  /**
   * Logo bytes with the stored MIME type (re-checked against the allowlist
   * and the file signature). 404 when the point or its logo does not exist.
   */
  async getLogo(id: MapPoint['id']): Promise<MapPointLogo> {
    const dataUrl = await this.mapPointRepository.findLogo(id);
    const logo = dataUrl
      ? decodeImageDataUrl(dataUrl, MAP_POINT_LOGO_MIME_TYPES)
      : null;
    if (!logo) {
      throw new NotFoundException('Logo not found');
    }
    return logo;
  }

  /** Idempotent; 404 when the point does not exist or was deleted. */
  async setFavorite(
    userId: User['id'],
    id: MapPoint['id'],
    isFavorite: boolean,
  ): Promise<MapPointFavoriteState> {
    if (!(await this.mapPointRepository.exists(id))) {
      throw this.notFound();
    }
    if (isFavorite) {
      await this.mapPointRepository.addFavorite(Number(userId), id);
    } else {
      await this.mapPointRepository.removeFavorite(Number(userId), id);
    }
    const state = new MapPointFavoriteState();
    state.isFavorite = isFavorite;
    return state;
  }

  /**
   * Free plan: at most FREE_ACTIVITIES_LIMIT activities. The balance (stage 2)
   * will unlock more here.
   */
  private assertActivitiesAllowed(activities: ActivityCode[]): ActivityCode[] {
    if (activities.length > FREE_ACTIVITIES_LIMIT) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          activities: 'premiumRequired',
        },
      });
    }
    return activities;
  }

  private async presentOne(
    viewerId: User['id'],
    point: MapPoint,
  ): Promise<MapPointView> {
    const [view] = await this.present(viewerId, [point]);
    return view;
  }

  private async present(
    viewerId: User['id'],
    points: MapPoint[],
  ): Promise<MapPointView[]> {
    if (points.length === 0) {
      return [];
    }
    const [favoriteIds, ranks] = await Promise.all([
      this.mapPointRepository.findFavoriteIds(
        Number(viewerId),
        points.map((point) => point.id),
      ),
      this.userRankService.getRanks(
        points.map((point) => Number(point.userId)),
      ),
    ]);
    return points.map((point) =>
      toMapPointView(
        point,
        favoriteIds.has(point.id),
        ranks.get(Number(point.userId)) ?? 0,
      ),
    );
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Map point not found');
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
