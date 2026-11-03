import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MapPointsService } from './map-points.service';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import { FilesService } from '../files/files.service';
import { UserRankService } from '../user-rank/user-rank.service';
import { MapPoint } from './domain/map-point';
import { MapPointView } from './domain/map-point-view';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { MapPointPresenter } from './map-point.presenter';
import { RoleEnum } from '../roles/roles.enum';
import { NetworkActor } from '../users-directory/user-visibility';
import { MapPointParentCycleError } from './infrastructure/persistence/map-point.repository';

const STAFF: NetworkActor = { userId: 3, roleId: RoleEnum.staff };
const OWNER: NetworkActor = { userId: 7, roleId: RoleEnum.user };
const OTHER_VIEWER: NetworkActor = { userId: 9, roleId: RoleEnum.user };

describe('MapPointsService', () => {
  let service: MapPointsService;
  let repo: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    findLogo: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    findFavoriteIds: jest.Mock;
    addFavorite: jest.Mock;
    removeFavorite: jest.Mock;
    countTeamSizes: jest.Mock;
  };
  let files: { findById: jest.Mock };
  let ranks: { getRanks: jest.Mock };

  const point: MapPoint = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 7,
    kind: 'head_office',
    visibility: 'public',
    lat: 45.42,
    lng: 28.2,
    firstName: 'Avalon Shipping',
    lastName: '',
    activity: '',
    activities: ['ship_agency'],
    activitySlots: 1,
    hasLogo: false,
    phone: null,
    email: null,
    emailVerified: false,
    address: null,
    description: null,
    website: null,
    parentId: null,
    notes: null,
    photoId: null,
    createdBy: {
      id: 7,
      firstName: 'Ion',
      lastName: 'Popescu',
      email: 'ion@example.com',
      role: 'viewer',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const other: MapPoint = {
    ...point,
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    userId: 8,
    createdBy: {
      id: 8,
      firstName: null,
      lastName: null,
      email: null,
      role: 'viewer',
    },
  };
  const teamOnly: MapPoint = {
    ...other,
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    visibility: 'team',
  };

  const premiumRequired = {
    response: { status: 422, errors: { activities: 'premiumRequired' } },
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findLogo: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findFavoriteIds: jest.fn().mockResolvedValue(new Set<string>()),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      countTeamSizes: jest.fn().mockResolvedValue(new Map()),
    };
    files = { findById: jest.fn() };
    ranks = { getRanks: jest.fn().mockResolvedValue(new Map()) };
    const mapPointRepository = repo as unknown as MapPointRepository;
    service = new MapPointsService(
      mapPointRepository,
      files as unknown as FilesService,
      new MapPointPresenter(
        mapPointRepository,
        ranks as unknown as UserRankService,
      ),
    );
  });

  describe('create', () => {
    it('should use the JWT user as owner, default kind private_person (team-only) and no activities/logo', async () => {
      repo.create.mockResolvedValue(point);
      const dto: CreateMapPointDto = {
        lat: 45.42,
        lng: 28.2,
        firstName: 'Ion',
      };

      await service.create(OWNER, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          kind: 'private_person',
          visibility: 'team',
          firstName: 'Ion',
          lastName: '',
          activity: '',
          activities: [],
          logo: null,
          notes: null,
          photoId: null,
          description: null,
          website: null,
          parentId: null,
        }),
        { max: 5 },
      );
      expect(repo.create.mock.calls[0][0]).not.toHaveProperty('isFavorite');
    });

    it('should make other kinds public by default and keep an explicit visibility', async () => {
      repo.create.mockResolvedValue(point);

      await service.create(OWNER, {
        lat: 1,
        lng: 2,
        firstName: 'Avalon',
        kind: 'head_office',
      });
      await service.create(OWNER, {
        lat: 1,
        lng: 2,
        firstName: 'Avalon',
        kind: 'head_office',
        visibility: 'team',
      });

      expect(repo.create.mock.calls[0][0]).toMatchObject({
        visibility: 'public',
      });
      expect(repo.create.mock.calls[1][0]).toMatchObject({
        visibility: 'team',
      });
    });

    it('should not limit the team', async () => {
      repo.create.mockResolvedValue(point);
      await service.create(STAFF, { lat: 1, lng: 2, firstName: 'X' });
      expect(repo.create).toHaveBeenCalledWith(expect.anything(), null);
    });

    it('should return 422 limitReached when a viewer already has 5 points', async () => {
      repo.create.mockResolvedValue(null);

      const error = await service
        .create(OWNER, { lat: 1, lng: 2, firstName: 'Sixth' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error).toMatchObject({
        response: { status: 422, errors: { points: 'limitReached' } },
      });
    });

    it('should keep the kind, one activity, the logo and the profile fields', async () => {
      repo.create.mockResolvedValue(point);
      repo.findById.mockResolvedValue(other);

      await service.create(STAFF, {
        lat: 45.42,
        lng: 28.2,
        firstName: 'Avalon Shipping',
        kind: 'branch',
        activities: ['ship_agency'],
        logo: 'data:image/png;base64,iVBORw0KGgo=',
        description: 'Agency in Galati',
        website: 'https://avalon.example',
        parentId: other.id,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'branch',
          activities: ['ship_agency'],
          logo: 'data:image/png;base64,iVBORw0KGgo=',
          description: 'Agency in Galati',
          website: 'https://avalon.example',
          parentId: other.id,
        }),
        null,
      );
    });

    it('should return 422 premiumRequired for more activities than the one free slot', async () => {
      const error = await service
        .create(OWNER, {
          lat: 45.42,
          lng: 28.2,
          firstName: 'Avalon Shipping',
          activities: ['ship_agency', 'crewing'],
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error).toMatchObject(premiumRequired);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should reject a parent the caller cannot see as notFound', async () => {
      repo.findById.mockResolvedValue(teamOnly);

      await expect(
        service.create(OWNER, {
          lat: 1,
          lng: 2,
          firstName: 'Branch',
          parentId: teamOnly.id,
        }),
      ).rejects.toMatchObject({
        response: { errors: { parentId: 'notFound' } },
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should reject a visible parent the caller cannot edit as notFound', async () => {
      repo.findById.mockResolvedValue(other);

      await expect(
        service.create(OWNER, {
          lat: 1,
          lng: 2,
          firstName: 'Branch',
          parentId: other.id,
        }),
      ).rejects.toMatchObject({
        response: { errors: { parentId: 'notFound' } },
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should reject a photoId that does not exist', async () => {
      files.findById.mockResolvedValue(null);
      await expect(
        service.create(OWNER, {
          lat: 45.42,
          lng: 28.2,
          firstName: 'Ion',
          photoId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should return the view for the creator (isFavorite false, rank, canEdit, no inline logo)', async () => {
      repo.create.mockResolvedValue({ ...point, hasLogo: true });
      ranks.getRanks.mockResolvedValue(new Map([[7, 15]]));

      const view = await service.create(OWNER, {
        lat: 45.42,
        lng: 28.2,
        firstName: 'Avalon Shipping',
        logo: 'data:image/png;base64,iVBORw0KGgo=',
      });

      expect(view).toBeInstanceOf(MapPointView);
      expect(view).toMatchObject({
        id: point.id,
        hasLogo: true,
        logoVersion: String(point.updatedAt.getTime()),
        isFavorite: false,
        rank: 15,
        canEdit: true,
        memberCount: 1,
        activitySlots: 1,
        emailVerified: false,
      });
      expect(view).not.toHaveProperty('logo');
      expect(repo.findFavoriteIds).toHaveBeenCalledWith(7, [point.id]);
    });
  });

  describe('read', () => {
    it('should list every point for the team with favorites, ranks and member counts', async () => {
      repo.findAll.mockResolvedValue([point, other]);
      repo.findFavoriteIds.mockResolvedValue(new Set([other.id]));
      repo.countTeamSizes.mockResolvedValue(new Map([[point.id, 3]]));
      ranks.getRanks.mockResolvedValue(new Map([[7, 980]]));

      const views = await service.findAll(STAFF, { kind: 'head_office' });

      expect(repo.findAll).toHaveBeenCalledWith({
        kind: 'head_office',
        visibleTo: null,
        limit: 1000,
      });
      expect(ranks.getRanks).toHaveBeenCalledWith([7, 8]);
      expect(
        views.map(({ id, isFavorite, rank, canEdit, memberCount }) => ({
          id,
          isFavorite,
          rank,
          canEdit,
          memberCount,
        })),
      ).toEqual([
        {
          id: point.id,
          isFavorite: false,
          rank: 980,
          canEdit: true,
          memberCount: 3,
        },
        // a creator without a computed rank gets 0
        {
          id: other.id,
          isFavorite: true,
          rank: 0,
          canEdit: true,
          memberCount: 1,
        },
      ]);
    });

    it('should list public points and own points for a viewer, editable only when owned', async () => {
      repo.findAll.mockResolvedValue([point, other]);

      const views = await service.findAll(OWNER, {});

      expect(repo.findAll).toHaveBeenCalledWith({
        kind: undefined,
        visibleTo: 7,
        limit: 1000,
      });
      expect(views.map((view) => view.canEdit)).toEqual([true, false]);
    });

    it('should always include the caller own points when the 1000 cap is hit', async () => {
      const newest = Array.from({ length: 1000 }, (_, index) => ({
        ...other,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      }));
      const ownOld = { ...point, createdAt: new Date('2020-01-01') };
      repo.findAll
        .mockResolvedValueOnce(newest)
        .mockResolvedValueOnce([ownOld]);

      const views = await service.findAll(OWNER, {});

      expect(repo.findAll).toHaveBeenNthCalledWith(2, {
        kind: undefined,
        visibleTo: 7,
        ownerId: 7,
        limit: 1000,
      });
      expect(views).toHaveLength(1001);
      expect(views[1000].id).toBe(point.id);
    });

    it('should not run the own-points query below the cap', async () => {
      repo.findAll.mockResolvedValue([point]);
      await service.findAll(OWNER, {});
      expect(repo.findAll).toHaveBeenCalledTimes(1);
    });

    it('should never give the legacy team notes to callers who cannot edit', async () => {
      repo.findById.mockResolvedValue({ ...point, notes: 'Team only' });

      await expect(
        service.findById(OTHER_VIEWER, point.id),
      ).resolves.toMatchObject({ notes: null });
      await expect(service.findById(OWNER, point.id)).resolves.toMatchObject({
        notes: 'Team only',
      });
      await expect(service.findById(STAFF, point.id)).resolves.toMatchObject({
        notes: 'Team only',
      });
    });

    it('should show viewers the email of a team creator, not of another client', async () => {
      repo.findById.mockResolvedValue({
        ...other,
        createdBy: {
          id: 3,
          firstName: 'Ana',
          lastName: null,
          email: 'staff@example.com',
          role: 'staff',
        },
      });
      await expect(
        service.findById(OTHER_VIEWER, other.id),
      ).resolves.toMatchObject({ createdBy: { email: 'staff@example.com' } });
    });

    it('should hide the creator email of foreign points from a viewer', async () => {
      repo.findById.mockResolvedValue(point);

      await expect(
        service.findById(OTHER_VIEWER, point.id),
      ).resolves.toMatchObject({ createdBy: { id: 7, email: null } });
      await expect(service.findById(OWNER, point.id)).resolves.toMatchObject({
        createdBy: { id: 7, email: 'ion@example.com' },
      });
      await expect(service.findById(STAFF, point.id)).resolves.toMatchObject({
        createdBy: { id: 7, email: 'ion@example.com' },
      });
    });

    it('should not query favorites or ranks for an empty list', async () => {
      repo.findAll.mockResolvedValue([]);
      await expect(service.findAll(STAFF, {})).resolves.toEqual([]);
      expect(repo.findFavoriteIds).not.toHaveBeenCalled();
      expect(ranks.getRanks).not.toHaveBeenCalled();
    });

    it('should return a point by id with the caller view', async () => {
      repo.findById.mockResolvedValue(point);
      repo.findFavoriteIds.mockResolvedValue(new Set([point.id]));

      const view = await service.findById(STAFF, point.id);

      expect(view).toMatchObject({
        id: point.id,
        activities: ['ship_agency'],
        hasLogo: false,
        logoVersion: null,
        isFavorite: true,
        rank: 0,
      });
      expect(view).not.toHaveProperty('logo');
    });

    it('should give a point with a logo a logoVersion from updatedAt, never the logo itself', async () => {
      const updatedAt = new Date('2026-11-03T10:20:30.456Z');
      repo.findById.mockResolvedValue({ ...point, hasLogo: true, updatedAt });

      const view = await service.findById(STAFF, point.id);

      expect(view.hasLogo).toBe(true);
      expect(view.logoVersion).toBe(String(updatedAt.getTime()));
      expect(view).not.toHaveProperty('logo');
    });

    it('should return 404 when the point is missing or deleted', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(STAFF, point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return 404 for a team-only point of someone else to a viewer, not to the team', async () => {
      repo.findById.mockResolvedValue(teamOnly);
      await expect(
        service.findById(OTHER_VIEWER, teamOnly.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.findById(STAFF, teamOnly.id)).resolves.toMatchObject(
        { id: teamOnly.id },
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repo.findById.mockResolvedValue(point);
      repo.update.mockResolvedValue(point);
    });

    it('should pass only provided fields (incl. activities, logo and profile fields) to update', async () => {
      await service.update(STAFF, point.id, {
        kind: 'branch',
        activities: ['crewing'],
        logo: null,
        notes: null,
        visibility: 'team',
        description: null,
        website: 'https://avalon.example',
      });

      expect(repo.update).toHaveBeenCalledWith(point.id, {
        kind: 'branch',
        activities: ['crewing'],
        logo: null,
        notes: null,
        visibility: 'team',
        description: null,
        website: 'https://avalon.example',
      });
    });

    it('should let the owner (viewer) edit their own point', async () => {
      await expect(
        service.update(OWNER, point.id, { firstName: 'Renamed' }),
      ).resolves.toMatchObject({ id: point.id, canEdit: true });
      expect(repo.update).toHaveBeenCalledWith(point.id, {
        firstName: 'Renamed',
      });
    });

    it('should return 403 to a viewer editing or deleting a public point of someone else', async () => {
      await expect(
        service.update(OTHER_VIEWER, point.id, { firstName: 'Mine now' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.remove(OTHER_VIEWER, point.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('should return 404 to a viewer editing a hidden team-only point', async () => {
      repo.findById.mockResolvedValue(teamOnly);
      await expect(
        service.update(OTHER_VIEWER, teamOnly.id, { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should allow clearing the activities', async () => {
      await service.update(STAFF, point.id, { activities: [] });
      expect(repo.update).toHaveBeenCalledWith(point.id, { activities: [] });
    });

    it('should pass lastName "" and activity "" through, so the stored values are cleared', async () => {
      await service.update(STAFF, point.id, {
        firstName: 'Ion Popescu',
        lastName: '',
        activity: '',
      });

      expect(repo.update).toHaveBeenCalledWith(point.id, {
        firstName: 'Ion Popescu',
        lastName: '',
        activity: '',
      });
    });

    it('should allow as many activities as bought slots and no more', async () => {
      repo.findById.mockResolvedValue({ ...point, activitySlots: 2 });

      await service.update(STAFF, point.id, {
        activities: ['ship_agency', 'crewing'],
      });
      const error = await service
        .update(STAFF, point.id, {
          activities: ['ship_agency', 'crewing', 'ship_repair'],
        })
        .catch((e: unknown) => e);

      expect(repo.update).toHaveBeenCalledTimes(1);
      expect(error).toMatchObject(premiumRequired);
    });

    it('should return 422 premiumRequired for more than one activity on a one-slot point', async () => {
      const error = await service
        .update(STAFF, point.id, { activities: ['ship_agency', 'crewing'] })
        .catch((e: unknown) => e);

      expect(error).toMatchObject(premiumRequired);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should reject the point itself or one of its branches as parent', async () => {
      await expect(
        service.update(STAFF, point.id, { parentId: point.id }),
      ).rejects.toMatchObject({
        response: { errors: { parentId: 'invalid' } },
      });

      expect(repo.update).not.toHaveBeenCalled();

      // deeper cycles are found by the repository, under its parent lock
      repo.findById
        .mockResolvedValueOnce(point)
        .mockResolvedValueOnce({ ...other, parentId: point.id });
      repo.update.mockRejectedValue(new MapPointParentCycleError());
      await expect(
        service.update(STAFF, point.id, { parentId: other.id }),
      ).rejects.toMatchObject({
        response: { errors: { parentId: 'invalid' } },
      });
    });

    it('should make a point team-only when it becomes a private person, unless visibility is sent', async () => {
      await service.update(STAFF, point.id, { kind: 'private_person' });
      await service.update(STAFF, point.id, {
        kind: 'private_person',
        visibility: 'public',
      });

      expect(repo.update).toHaveBeenNthCalledWith(1, point.id, {
        kind: 'private_person',
        visibility: 'team',
      });
      expect(repo.update).toHaveBeenNthCalledWith(2, point.id, {
        kind: 'private_person',
        visibility: 'public',
      });
    });

    it('should set and clear a parent', async () => {
      repo.findById.mockResolvedValueOnce(point).mockResolvedValueOnce(other);

      await service.update(STAFF, point.id, { parentId: other.id });
      await service.update(STAFF, point.id, { parentId: null });

      expect(repo.update).toHaveBeenNthCalledWith(1, point.id, {
        parentId: other.id,
      });
      expect(repo.update).toHaveBeenNthCalledWith(2, point.id, {
        parentId: null,
      });
    });

    it('should return 404 on update when the point does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update(STAFF, point.id, { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should return 404 on remove when the point does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove(STAFF, point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should let the team and the owner remove a point', async () => {
      repo.findById.mockResolvedValue(point);
      repo.remove.mockResolvedValue(true);
      await expect(service.remove(STAFF, point.id)).resolves.toBeUndefined();
      await expect(service.remove(OWNER, point.id)).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(point.id);
    });
  });

  describe('getLogo', () => {
    const pngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16, 3),
    ]);

    beforeEach(() => {
      repo.findById.mockResolvedValue(point);
    });

    it('should decode the stored data URL into bytes with its MIME type', async () => {
      repo.findLogo.mockResolvedValue(
        `data:image/png;base64,${pngBytes.toString('base64')}`,
      );

      const logo = await service.getLogo(STAFF, point.id);

      expect(repo.findLogo).toHaveBeenCalledWith(point.id);
      expect(logo.mimeType).toBe('image/png');
      expect(logo.bytes.equals(pngBytes)).toBe(true);
    });

    it('should return 404 when the point or its logo does not exist', async () => {
      repo.findLogo.mockResolvedValue(null);
      await expect(service.getLogo(STAFF, point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return 404 for the logo of a point hidden from the caller', async () => {
      repo.findById.mockResolvedValue(teamOnly);
      await expect(
        service.getLogo(OTHER_VIEWER, teamOnly.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findLogo).not.toHaveBeenCalled();
    });

    it('should return 404 rather than serve a stored value that is not an allowed image', async () => {
      repo.findLogo.mockResolvedValue(
        `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
      );
      await expect(service.getLogo(STAFF, point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('favorites', () => {
    it('should add to the caller favorites and stay idempotent', async () => {
      repo.findById.mockResolvedValue(point);

      await expect(
        service.setFavorite(OTHER_VIEWER, point.id, true),
      ).resolves.toEqual({ isFavorite: true });
      await expect(
        service.setFavorite(OTHER_VIEWER, point.id, true),
      ).resolves.toEqual({ isFavorite: true });

      expect(repo.addFavorite).toHaveBeenCalledTimes(2);
      expect(repo.addFavorite).toHaveBeenCalledWith(9, point.id);
      expect(repo.removeFavorite).not.toHaveBeenCalled();
    });

    it('should remove from the caller favorites, also when it was not a favorite', async () => {
      repo.findById.mockResolvedValue(point);

      await expect(
        service.setFavorite(STAFF, point.id, false),
      ).resolves.toEqual({ isFavorite: false });

      expect(repo.removeFavorite).toHaveBeenCalledWith(3, point.id);
      expect(repo.addFavorite).not.toHaveBeenCalled();
    });

    it('should return 404 for a missing, deleted or hidden point', async () => {
      repo.findById.mockResolvedValueOnce(null).mockResolvedValueOnce(teamOnly);

      await expect(
        service.setFavorite(STAFF, point.id, true),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.setFavorite(OTHER_VIEWER, teamOnly.id, false),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repo.addFavorite).not.toHaveBeenCalled();
      expect(repo.removeFavorite).not.toHaveBeenCalled();
    });
  });
});
