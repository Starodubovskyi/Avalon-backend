import { Injectable } from '@nestjs/common';
import { UserRankService } from '../user-rank/user-rank.service';
import { canSeeEmail, NetworkActor } from '../users-directory/user-visibility';
import { MapPoint } from './domain/map-point';
import { MapPointView, toMapPointView } from './domain/map-point-view';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import { canEditPoint } from './map-point-access';

/**
 * Turns stored points into the caller's views: personal `isFavorite`, the
 * owner's `rank`, `canEdit`, `memberCount` (team size). Three queries for any
 * number of points. Callers who cannot edit a point never get its legacy
 * team `notes`; viewers do not get the emails of other clients (creator).
 */
@Injectable()
export class MapPointPresenter {
  constructor(
    private readonly mapPointRepository: MapPointRepository,
    private readonly userRankService: UserRankService,
  ) {}

  async present(
    actor: NetworkActor,
    points: MapPoint[],
  ): Promise<MapPointView[]> {
    if (points.length === 0) {
      return [];
    }
    const ids = points.map((point) => point.id);
    const [favoriteIds, ranks, teamSizes] = await Promise.all([
      this.mapPointRepository.findFavoriteIds(actor.userId, ids),
      this.userRankService.getRanks(
        points.map((point) => Number(point.userId)),
      ),
      this.mapPointRepository.countTeamSizes(ids),
    ]);
    return points.map((point) => {
      const canEdit = canEditPoint(actor, point);
      return toMapPointView(this.redact(point, actor, canEdit), {
        isFavorite: favoriteIds.has(point.id),
        rank: ranks.get(Number(point.userId)) ?? 0,
        canEdit,
        memberCount: teamSizes.get(point.id) ?? 1,
      });
    });
  }

  async presentOne(
    actor: NetworkActor,
    point: MapPoint,
  ): Promise<MapPointView> {
    const [view] = await this.present(actor, [point]);
    return view;
  }

  private redact(
    point: MapPoint,
    actor: NetworkActor,
    canEdit: boolean,
  ): MapPoint {
    const creator = point.createdBy;
    return {
      ...point,
      notes: canEdit ? point.notes : null,
      createdBy:
        creator && !canSeeEmail(actor, creator)
          ? { ...creator, email: null }
          : creator,
    };
  }
}
