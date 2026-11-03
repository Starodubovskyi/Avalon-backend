import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { MapPoint } from '../map-points/domain/map-point';
import { MapPointView } from '../map-points/domain/map-point-view';
import { MapPointRepository } from '../map-points/infrastructure/persistence/map-point.repository';
import { assertCanEditPoint } from '../map-points/map-point-access';
import { MapPointPresenter } from '../map-points/map-point.presenter';
import { MapPointsService } from '../map-points/map-points.service';
import { RoleEnum } from '../roles/roles.enum';
import { UserRankService } from '../user-rank/user-rank.service';
import { toUserCard } from '../users-directory/domain/user-card';
import { NetworkActor } from '../users-directory/user-visibility';
import { CompaniesService } from './companies.service';
import { CompanyMemberRecord } from './domain/company';
import { CompanyMemberRepository } from './infrastructure/persistence/company-member.repository';

const OWNER: NetworkActor = { userId: 7, roleId: RoleEnum.user };
const OUTSIDER: NetworkActor = { userId: 9, roleId: RoleEnum.user };
const STAFF: NetworkActor = { userId: 3, roleId: RoleEnum.staff };
const POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const point = {
  id: POINT_ID,
  userId: 7,
  visibility: 'public',
  parentId: null,
  firstName: 'Avalon Shipping',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
} as unknown as MapPoint;

function member(
  userId: number,
  status: 'pending' | 'active',
  email = `user${userId}@example.com`,
): CompanyMemberRecord {
  return {
    user: toUserCard({
      id: userId,
      firstName: `User${userId}`,
      lastName: null,
      email,
      roleId: RoleEnum.user,
    }),
    headline: null,
    position: status === 'active' ? 'Agent' : null,
    status,
    createdAt: '2026-02-01T00:00:00.000Z',
  };
}

describe('CompaniesService', () => {
  let points: { getVisiblePoint: jest.Mock; getEditablePoint: jest.Mock };
  let pointRepo: { findAll: jest.Mock; findById: jest.Mock };
  let members: {
    findMembers: jest.Mock;
    findMember: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    findActivePointIds: jest.Mock;
    findPersonCard: jest.Mock;
  };
  let service: CompaniesService;

  beforeEach(() => {
    points = {
      getVisiblePoint: jest.fn().mockResolvedValue(point),
      getEditablePoint: jest.fn((actor: NetworkActor) =>
        Promise.resolve(assertCanEditPoint(actor, point)),
      ),
    };
    pointRepo = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
    };
    members = {
      findMembers: jest.fn().mockResolvedValue([member(13, 'active')]),
      findMember: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(true),
      findActivePointIds: jest.fn().mockResolvedValue([]),
      findPersonCard: jest.fn().mockResolvedValue({
        user: toUserCard({
          id: 7,
          firstName: 'Owner',
          lastName: null,
          email: 'owner@example.com',
          roleId: RoleEnum.user,
        }),
        headline: 'Founder',
      }),
    };
    service = new CompaniesService(
      points as unknown as MapPointsService,
      pointRepo as unknown as MapPointRepository,
      {
        present: (_actor: NetworkActor, list: MapPoint[]) =>
          Promise.resolve(list.map((p) => ({ id: p.id }) as MapPointView)),
      } as unknown as MapPointPresenter,
      members as unknown as CompanyMemberRepository,
      {
        getRanks: jest.fn().mockResolvedValue(new Map([[13, 40]])),
      } as unknown as UserRankService,
    );
  });

  describe('profile', () => {
    it('should list the owner first and only active members to an outsider, without client emails', async () => {
      const profile = await service.getProfile(OUTSIDER, POINT_ID);

      expect(members.findMembers).toHaveBeenCalledWith(POINT_ID, false, 500);
      expect(profile.members.map((m) => [m.user.id, m.role, m.status])).toEqual(
        [
          [7, 'owner', 'active'],
          [13, 'member', 'active'],
        ],
      );
      expect(profile.members.map((m) => m.user.email)).toEqual([null, null]);
      expect(profile.members[1].rank).toBe(40);
      expect(profile).toMatchObject({ myMembership: null, canManage: false });
    });

    it('should include pending requests for the owner and the team', async () => {
      await service.getProfile(OWNER, POINT_ID);
      await service.getProfile(STAFF, POINT_ID);

      expect(members.findMembers).toHaveBeenNthCalledWith(
        1,
        POINT_ID,
        true,
        500,
      );
      expect(members.findMembers).toHaveBeenNthCalledWith(
        2,
        POINT_ID,
        true,
        500,
      );
    });

    it('should report my membership and branches visible to me', async () => {
      members.findMember.mockResolvedValue(member(9, 'pending'));
      const branch = { ...point, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
      pointRepo.findAll.mockResolvedValue([branch]);

      const profile = await service.getProfile(OUTSIDER, POINT_ID);

      expect(pointRepo.findAll).toHaveBeenCalledWith({
        parentId: POINT_ID,
        visibleTo: 9,
        limit: 200,
      });
      expect(profile.myMembership).toBe('pending');
      expect(profile.branches.map((b) => b.id)).toEqual([branch.id]);
      expect(profile.parent).toBeNull();
      await expect(service.getProfile(OWNER, POINT_ID)).resolves.toMatchObject({
        myMembership: 'owner',
        canManage: true,
      });
    });
  });

  describe('join', () => {
    it('should create a pending membership with the position', async () => {
      await service.join(OUTSIDER, POINT_ID, { position: 'Port agent' });
      expect(members.create).toHaveBeenCalledWith(POINT_ID, 9, 'Port agent');
    });

    it('should return 422 owner for the owner and exists for a second request', async () => {
      await expect(service.join(OWNER, POINT_ID, {})).rejects.toMatchObject({
        response: { status: 422, errors: { membership: 'owner' } },
      });

      const duplicate = new QueryFailedError('INSERT', [], new Error('dup'));
      Object.assign(duplicate, {
        driverError: { code: '23505', constraint: 'PK_company_member' },
      });
      members.create.mockRejectedValue(duplicate);
      await expect(service.join(OUTSIDER, POINT_ID, {})).rejects.toMatchObject({
        response: { errors: { membership: 'exists' } },
      });
    });
  });

  describe('members', () => {
    it('should let the owner approve a request and set the position', async () => {
      members.findMember.mockResolvedValue({
        ...member(13, 'active'),
        position: 'Captain',
      });

      const approved = await service.updateMember(OWNER, POINT_ID, 13, {
        status: 'active',
        position: 'Captain',
      });

      expect(members.update).toHaveBeenCalledWith(POINT_ID, 13, {
        status: 'active',
        position: 'Captain',
      });
      expect(approved).toMatchObject({
        role: 'member',
        status: 'active',
        position: 'Captain',
        rank: 40,
      });
    });

    it('should return 403 to someone who does not manage the company', async () => {
      await expect(
        service.updateMember(OUTSIDER, POINT_ID, 13, { status: 'active' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.removeMember(OUTSIDER, POINT_ID, 13),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(members.update).not.toHaveBeenCalled();
      expect(members.remove).not.toHaveBeenCalled();
    });

    it('should return 404 for a missing membership', async () => {
      members.remove.mockResolvedValue(false);
      await expect(
        service.updateMember(STAFF, POINT_ID, 99, { status: 'active' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.removeMember(STAFF, POINT_ID, 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should not approve a member whose account was deleted', async () => {
      // findMember() skips soft-deleted accounts
      members.findMember.mockResolvedValue(null);

      await expect(
        service.updateMember(OWNER, POINT_ID, 13, { status: 'active' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(members.update).not.toHaveBeenCalled();
    });

    it('should let a member leave, 404 when not a member', async () => {
      await expect(service.leave(OUTSIDER, POINT_ID)).resolves.toBeUndefined();
      expect(members.remove).toHaveBeenCalledWith(POINT_ID, 9);

      members.remove.mockResolvedValue(false);
      await expect(service.leave(OUTSIDER, POINT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('mine', () => {
    it('should merge my points and active memberships, newest first, without duplicates', async () => {
      const older = {
        ...point,
        id: 'p-old',
        createdAt: new Date('2025-01-01'),
      };
      const newer = {
        ...point,
        id: 'p-new',
        createdAt: new Date('2026-06-01'),
      };
      members.findActivePointIds.mockResolvedValue(['p-new']);
      pointRepo.findAll
        .mockResolvedValueOnce([older, newer])
        .mockResolvedValueOnce([newer]);

      const mine = await service.findMine(OUTSIDER);

      expect(pointRepo.findAll).toHaveBeenNthCalledWith(1, {
        ownerId: 9,
        visibleTo: 9,
        limit: 1000,
      });
      expect(pointRepo.findAll).toHaveBeenNthCalledWith(2, {
        ids: ['p-new'],
        visibleTo: 9,
        limit: 1000,
      });
      expect(mine.map((p) => p.id)).toEqual(['p-new', 'p-old']);
    });
  });
});
