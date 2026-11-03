import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { UpdateMapPointDto } from './dto/update-map-point.dto';
import { QueryMapPointDto } from './dto/query-map-point.dto';
import {
  MapPointParentCycleError,
  MapPointPatch,
  MapPointRepository,
} from './infrastructure/persistence/map-point.repository';
import { MapPoint } from './domain/map-point';
import {
  MapPointFavoriteState,
  MapPointLogo,
  MapPointView,
} from './domain/map-point-view';
import { FilesService } from '../files/files.service';
import { decodeImageDataUrl } from '../utils/validators/is-image-data-url';
import { unprocessable } from '../utils/unprocessable';
import { isTeamRole, NetworkActor } from '../users-directory/user-visibility';
import {
  ActivityCode,
  CLIENT_POINT_LIMIT,
  DEFAULT_ACTIVITY_SLOTS,
  DEFAULT_MAP_POINT_KIND,
  MAP_POINT_LIST_LIMIT,
  MAP_POINT_LOGO_MIME_TYPES,
  MapPointKind,
  MapPointVisibility,
} from './map-point.constants';
import {
  assertCanEditPoint,
  assertCanSeePoint,
  canEditPoint,
  pointListScope,
} from './map-point-access';
import { MapPointPresenter } from './map-point.presenter';

/**
 * Map points of the team and of clients. The team (admin/staff) reads and
 * edits every point; a viewer reads public points and their own, creates up
 * to CLIENT_POINT_LIMIT and edits only their own (403 otherwise; a point
 * they cannot see is 404). userId always stays the creator (owner).
 * Logos are never part of the view: `hasLogo`/`logoVersion` point to getLogo().
 */
@Injectable()
export class MapPointsService {
  constructor(
    private readonly mapPointRepository: MapPointRepository,
    private readonly filesService: FilesService,
    private readonly presenter: MapPointPresenter,
  ) {}

  async create(
    actor: NetworkActor,
    createMapPointDto: CreateMapPointDto,
  ): Promise<MapPointView> {
    const activities = this.assertActivitiesFit(
      createMapPointDto.activities ?? [],
      DEFAULT_ACTIVITY_SLOTS,
    );
    const photoId = await this.resolvePhotoId(createMapPointDto.photoId);
    const parentId = createMapPointDto.parentId
      ? await this.resolveParentId(actor, createMapPointDto.parentId, null)
      : null;
    const kind = createMapPointDto.kind ?? DEFAULT_MAP_POINT_KIND;

    const point = await this.mapPointRepository.create(
      {
        userId: actor.userId,
        kind,
        visibility: createMapPointDto.visibility ?? defaultVisibility(kind),
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
        description: createMapPointDto.description ?? null,
        website: createMapPointDto.website ?? null,
        parentId,
      },
      isTeamRole(actor.roleId) ? null : { max: CLIENT_POINT_LIMIT },
    );
    if (!point) {
      throw unprocessable('points', 'limitReached');
    }
    return this.presenter.presentOne(actor, point);
  }

  async findAll(
    actor: NetworkActor,
    query: QueryMapPointDto,
  ): Promise<MapPointView[]> {
    const scope = pointListScope(actor);
    const points = await this.mapPointRepository.findAll({
      kind: query.kind,
      visibleTo: scope,
      limit: MAP_POINT_LIST_LIMIT,
    });
    if (points.length < MAP_POINT_LIST_LIMIT) {
      return this.presenter.present(actor, points);
    }
    // The newest-first cap was hit: the caller's own points are always listed.
    const own = await this.mapPointRepository.findAll({
      kind: query.kind,
      visibleTo: scope,
      ownerId: actor.userId,
      limit: MAP_POINT_LIST_LIMIT,
    });
    return this.presenter.present(actor, mergeNewestFirst(points, own));
  }

  async findById(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPointView> {
    return this.presenter.presentOne(
      actor,
      await this.getVisiblePoint(actor, id),
    );
  }

  /** 404 when the point is missing, deleted or hidden from the actor. */
  async getVisiblePoint(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPoint> {
    return assertCanSeePoint(actor, await this.mapPointRepository.findById(id));
  }

  /** getVisiblePoint() + 403 unless the actor is the owner or the team. */
  async getEditablePoint(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPoint> {
    return assertCanEditPoint(
      actor,
      await this.mapPointRepository.findById(id),
    );
  }

  async update(
    actor: NetworkActor,
    id: MapPoint['id'],
    updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPointView> {
    const point = await this.getEditablePoint(actor, id);
    if (updateMapPointDto.activities !== undefined) {
      this.assertActivitiesFit(
        updateMapPointDto.activities,
        point.activitySlots,
      );
    }
    const photoId =
      updateMapPointDto.photoId === undefined
        ? undefined
        : await this.resolvePhotoId(updateMapPointDto.photoId);
    const parentId =
      updateMapPointDto.parentId === undefined ||
      updateMapPointDto.parentId === null
        ? updateMapPointDto.parentId
        : await this.resolveParentId(actor, updateMapPointDto.parentId, id);

    const patch = toMapPointPatch(updateMapPointDto, photoId, parentId);
    // A private person is team-only unless the request says otherwise.
    if (
      updateMapPointDto.kind === 'private_person' &&
      updateMapPointDto.visibility === undefined
    ) {
      patch.visibility = 'team';
    }

    let updated: MapPoint | null;
    try {
      updated = await this.mapPointRepository.update(id, patch);
    } catch (error) {
      if (error instanceof MapPointParentCycleError) {
        throw unprocessable('parentId', 'invalid');
      }
      throw error;
    }
    if (!updated) {
      throw this.notFound();
    }
    return this.presenter.presentOne(actor, updated);
  }

  async remove(actor: NetworkActor, id: MapPoint['id']): Promise<void> {
    await this.getEditablePoint(actor, id);
    if (!(await this.mapPointRepository.remove(id))) {
      throw this.notFound();
    }
  }

  /**
   * Logo bytes with the stored MIME type (re-checked against the allowlist
   * and the file signature). 404 when the point (as seen by the actor) or
   * its logo does not exist.
   */
  async getLogo(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPointLogo> {
    await this.getVisiblePoint(actor, id);
    const dataUrl = await this.mapPointRepository.findLogo(id);
    const logo = dataUrl
      ? decodeImageDataUrl(dataUrl, MAP_POINT_LOGO_MIME_TYPES)
      : null;
    if (!logo) {
      throw new NotFoundException('Logo not found');
    }
    return logo;
  }

  /** Idempotent; 404 when the point does not exist, was deleted or is hidden. */
  async setFavorite(
    actor: NetworkActor,
    id: MapPoint['id'],
    isFavorite: boolean,
  ): Promise<MapPointFavoriteState> {
    await this.getVisiblePoint(actor, id);
    if (isFavorite) {
      await this.mapPointRepository.addFavorite(actor.userId, id);
    } else {
      await this.mapPointRepository.removeFavorite(actor.userId, id);
    }
    const state = new MapPointFavoriteState();
    state.isFavorite = isFavorite;
    return state;
  }

  /** More activities than the point's slots → 422 premiumRequired. */
  private assertActivitiesFit(
    activities: ActivityCode[],
    slots: number,
  ): ActivityCode[] {
    if (activities.length > slots) {
      throw unprocessable('activities', 'premiumRequired');
    }
    return activities;
  }

  /**
   * The parent must be a point the actor may edit (owner or team): nobody
   * attaches branches to someone else's company. It may not be the point
   * itself; deeper cycles are checked by the repository under a lock.
   */
  private async resolveParentId(
    actor: NetworkActor,
    parentId: string,
    pointId: string | null,
  ): Promise<string> {
    if (parentId === pointId) {
      throw unprocessable('parentId', 'invalid');
    }
    const parent = await this.mapPointRepository.findById(parentId);
    if (!parent || !canEditPoint(actor, parent)) {
      throw unprocessable('parentId', 'notFound');
    }
    return parent.id;
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
      throw unprocessable('photoId', 'fileNotExists');
    }
    return file.id;
  }
}

/** Both lists newest first; duplicates (by id) are dropped. */
function mergeNewestFirst(a: MapPoint[], b: MapPoint[]): MapPoint[] {
  const byId = new Map<string, MapPoint>();
  for (const point of [...a, ...b]) {
    byId.set(point.id, point);
  }
  return [...byId.values()].sort(
    (x, y) =>
      y.createdAt.getTime() - x.createdAt.getTime() || y.id.localeCompare(x.id),
  );
}

/** Private persons start team-only; every other kind starts public. */
function defaultVisibility(kind: MapPointKind): MapPointVisibility {
  return kind === 'private_person' ? 'team' : 'public';
}

const PATCH_FIELDS = [
  'kind',
  'visibility',
  'lat',
  'lng',
  'firstName',
  'lastName',
  'activity',
  'activities',
  'logo',
  'phone',
  'email',
  'address',
  'notes',
  'description',
  'website',
] as const;

/** Only the fields present in the request (undefined = keep). */
function toMapPointPatch(
  dto: UpdateMapPointDto,
  photoId: string | null | undefined,
  parentId: string | null | undefined,
): MapPointPatch {
  const patch: MapPointPatch = {};
  for (const field of PATCH_FIELDS) {
    if (dto[field] !== undefined) {
      Object.assign(patch, { [field]: dto[field] });
    }
  }
  if (photoId !== undefined) {
    patch.photoId = photoId;
  }
  if (parentId !== undefined) {
    patch.parentId = parentId;
  }
  return patch;
}
