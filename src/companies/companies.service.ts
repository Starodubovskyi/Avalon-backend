import { Injectable, NotFoundException } from '@nestjs/common';
import { MapPoint } from '../map-points/domain/map-point';
import { MapPointView } from '../map-points/domain/map-point-view';
import { MapPointRepository } from '../map-points/infrastructure/persistence/map-point.repository';
import {
  canEditPoint,
  canSeePoint,
  isPointOwner,
  pointListScope,
} from '../map-points/map-point-access';
import { MAP_POINT_LIST_LIMIT } from '../map-points/map-point.constants';
import { MapPointPresenter } from '../map-points/map-point.presenter';
import { MapPointsService } from '../map-points/map-points.service';
import { UserRankService } from '../user-rank/user-rank.service';
import {
  NetworkActor,
  redactUserCard,
} from '../users-directory/user-visibility';
import { isUniqueViolation } from '../utils/is-unique-violation';
import { unprocessable } from '../utils/unprocessable';
import {
  COMPANY_BRANCHES_LIMIT,
  COMPANY_MEMBERS_LIMIT,
  CompanyMembership,
} from './companies.constants';
import {
  CompanyMember,
  CompanyMemberRecord,
  CompanyProfile,
} from './domain/company';
import { JoinCompanyDto } from './dto/join-company.dto';
import { UpdateCompanyMemberDto } from './dto/update-company-member.dto';
import { CompanyMemberRepository } from './infrastructure/persistence/company-member.repository';

const MEMBER_PK = 'PK_company_member';

/**
 * Company profile of a map point: the point, its parent and branches, and
 * the team (owner + members). "I work here" creates a pending membership;
 * the owner or admin/staff approve it and set the position. Pending requests
 * are visible only to them.
 */
@Injectable()
export class CompaniesService {
  constructor(
    private readonly mapPointsService: MapPointsService,
    private readonly mapPointRepository: MapPointRepository,
    private readonly presenter: MapPointPresenter,
    private readonly memberRepository: CompanyMemberRepository,
    private readonly userRankService: UserRankService,
  ) {}

  async getProfile(
    actor: NetworkActor,
    pointId: string,
  ): Promise<CompanyProfile> {
    const point = await this.mapPointsService.getVisiblePoint(actor, pointId);
    const canManage = canEditPoint(actor, point);
    const [parent, branches, records, mine] = await Promise.all([
      this.findVisibleParent(actor, point),
      this.mapPointRepository.findAll({
        parentId: point.id,
        visibleTo: pointListScope(actor),
        limit: COMPANY_BRANCHES_LIMIT,
      }),
      this.memberRepository.findMembers(
        point.id,
        canManage,
        COMPANY_MEMBERS_LIMIT,
      ),
      this.memberRepository.findMember(point.id, actor.userId),
    ]);

    const views = await this.presenter.present(actor, [
      point,
      ...(parent ? [parent] : []),
      ...branches,
    ]);
    const profile = new CompanyProfile();
    profile.point = views[0];
    profile.parent = parent ? views[1] : null;
    profile.branches = views.slice(parent ? 2 : 1);
    profile.members = await this.toMembers(actor, point, records);
    profile.myMembership = myMembership(actor, point, mine);
    profile.canManage = canManage;
    return profile;
  }

  /** 422 { membership: "owner" | "exists" }. */
  async join(
    actor: NetworkActor,
    pointId: string,
    dto: JoinCompanyDto,
  ): Promise<CompanyProfile> {
    const point = await this.mapPointsService.getVisiblePoint(actor, pointId);
    if (isPointOwner(actor, point)) {
      throw unprocessable('membership', 'owner');
    }
    try {
      await this.memberRepository.create(
        point.id,
        actor.userId,
        dto.position ?? null,
      );
    } catch (error) {
      if (isUniqueViolation(error, MEMBER_PK)) {
        throw unprocessable('membership', 'exists');
      }
      throw error;
    }
    return this.getProfile(actor, point.id);
  }

  /** Leave (or withdraw a pending request); also when the point turned team-only. */
  async leave(actor: NetworkActor, pointId: string): Promise<void> {
    if (!(await this.memberRepository.remove(pointId, actor.userId))) {
      throw this.membershipNotFound();
    }
  }

  /** Owner or admin/staff: approve (status active) and/or set the position. */
  async updateMember(
    actor: NetworkActor,
    pointId: string,
    userId: number,
    dto: UpdateCompanyMemberDto,
  ): Promise<CompanyMember> {
    const point = await this.mapPointsService.getEditablePoint(actor, pointId);
    // findMember() skips soft-deleted accounts: nobody approves a deleted user.
    if (!(await this.memberRepository.findMember(point.id, userId))) {
      throw this.membershipNotFound();
    }
    const updated = await this.memberRepository.update(point.id, userId, {
      status: dto.status,
      position: dto.position,
    });
    const record = updated
      ? await this.memberRepository.findMember(point.id, userId)
      : null;
    if (!record) {
      throw this.membershipNotFound();
    }
    const [member] = await this.toMembers(actor, point, [record], false);
    return member;
  }

  /** Owner or admin/staff: decline a request or remove a member. */
  async removeMember(
    actor: NetworkActor,
    pointId: string,
    userId: number,
  ): Promise<void> {
    const point = await this.mapPointsService.getEditablePoint(actor, pointId);
    if (!(await this.memberRepository.remove(point.id, userId))) {
      throw this.membershipNotFound();
    }
  }

  /** My points and the points where I am an active member, newest first. */
  async findMine(actor: NetworkActor): Promise<MapPointView[]> {
    const scope = pointListScope(actor);
    const memberPointIds = await this.memberRepository.findActivePointIds(
      actor.userId,
    );
    const [owned, joined] = await Promise.all([
      this.mapPointRepository.findAll({
        ownerId: actor.userId,
        visibleTo: scope,
        limit: MAP_POINT_LIST_LIMIT,
      }),
      this.mapPointRepository.findAll({
        ids: memberPointIds,
        visibleTo: scope,
        limit: MAP_POINT_LIST_LIMIT,
      }),
    ]);
    const byId = new Map<string, MapPoint>();
    for (const point of [...owned, ...joined]) {
      byId.set(point.id, point);
    }
    const points = [...byId.values()].sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    );
    return this.presenter.present(actor, points);
  }

  private async findVisibleParent(
    actor: NetworkActor,
    point: MapPoint,
  ): Promise<MapPoint | null> {
    if (!point.parentId) {
      return null;
    }
    const parent = await this.mapPointRepository.findById(point.parentId);
    return parent && canSeePoint(actor, parent) ? parent : null;
  }

  /** Owner first (unless `withOwner` is false), emails redacted for viewers. */
  private async toMembers(
    actor: NetworkActor,
    point: MapPoint,
    records: CompanyMemberRecord[],
    withOwner = true,
  ): Promise<CompanyMember[]> {
    const ownerId = Number(point.userId);
    const owner = withOwner
      ? await this.memberRepository.findPersonCard(ownerId)
      : null;
    const ranks = await this.userRankService.getRanks([
      ownerId,
      ...records.map((record) => record.user.id),
    ]);
    const members: CompanyMember[] = [];
    if (owner) {
      members.push(
        toMember(actor, {
          user: owner.user,
          headline: owner.headline,
          position: null,
          role: 'owner',
          status: 'active',
          rank: ranks.get(ownerId) ?? 0,
          joinedAt: point.createdAt.toISOString(),
        }),
      );
    }
    for (const record of records) {
      members.push(
        toMember(actor, {
          user: record.user,
          headline: record.headline,
          position: record.position,
          role: 'member',
          status: record.status,
          rank: ranks.get(record.user.id) ?? 0,
          joinedAt: record.createdAt,
        }),
      );
    }
    return members;
  }

  private membershipNotFound(): NotFoundException {
    return new NotFoundException('Membership not found');
  }
}

function toMember(actor: NetworkActor, data: CompanyMember): CompanyMember {
  return Object.assign(new CompanyMember(), data, {
    user: redactUserCard(data.user, actor),
  });
}

function myMembership(
  actor: NetworkActor,
  point: MapPoint,
  mine: CompanyMemberRecord | null,
): CompanyMembership | null {
  if (isPointOwner(actor, point)) {
    return 'owner';
  }
  return mine?.status ?? null;
}
