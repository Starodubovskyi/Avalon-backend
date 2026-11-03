import {
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

describe('MapPointsService', () => {
  let service: MapPointsService;
  let repo: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    exists: jest.Mock;
    findLogo: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    findFavoriteIds: jest.Mock;
    addFavorite: jest.Mock;
    removeFavorite: jest.Mock;
  };
  let files: { findById: jest.Mock };
  let ranks: { getRanks: jest.Mock };

  const VIEWER = 3;

  const point: MapPoint = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 7,
    kind: 'head_office',
    lat: 45.42,
    lng: 28.2,
    firstName: 'Avalon Shipping',
    lastName: '',
    activity: '',
    activities: ['ship_agency'],
    hasLogo: false,
    phone: null,
    email: null,
    address: null,
    notes: null,
    photoId: null,
    createdBy: { id: 7, firstName: 'Ion', lastName: 'Popescu', email: null },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const other: MapPoint = {
    ...point,
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    userId: 8,
    createdBy: { id: 8, firstName: null, lastName: null, email: null },
  };

  const premiumRequired = {
    response: { status: 422, errors: { activities: 'premiumRequired' } },
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      findLogo: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findFavoriteIds: jest.fn().mockResolvedValue(new Set<string>()),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
    };
    files = { findById: jest.fn() };
    ranks = { getRanks: jest.fn().mockResolvedValue(new Map()) };
    service = new MapPointsService(
      repo as unknown as MapPointRepository,
      files as unknown as FilesService,
      ranks as unknown as UserRankService,
    );
  });

  describe('create', () => {
    it('should use the JWT user as creator, default kind private_person and no activities/logo', async () => {
      repo.create.mockResolvedValue(point);
      const dto: CreateMapPointDto = {
        lat: 45.42,
        lng: 28.2,
        firstName: 'Ion',
      };

      await service.create(7, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          kind: 'private_person',
          firstName: 'Ion',
          lastName: '',
          activity: '',
          activities: [],
          logo: null,
          notes: null,
          photoId: null,
        }),
      );
      expect(repo.create.mock.calls[0][0]).not.toHaveProperty('isFavorite');
    });

    it('should keep the kind, one activity, the logo and the legacy fields', async () => {
      repo.create.mockResolvedValue(point);

      await service.create(7, {
        lat: 45.42,
        lng: 28.2,
        firstName: 'Avalon Shipping',
        kind: 'head_office',
        activities: ['ship_agency'],
        logo: 'data:image/png;base64,iVBORw0KGgo=',
        activity: 'Port agent',
        notes: 'Main office',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'head_office',
          activities: ['ship_agency'],
          logo: 'data:image/png;base64,iVBORw0KGgo=',
          activity: 'Port agent',
          notes: 'Main office',
        }),
      );
    });

    it('should return 422 premiumRequired for more than one activity', async () => {
      const error = await service
        .create(7, {
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

    it('should reject a photoId that does not exist', async () => {
      files.findById.mockResolvedValue(null);
      await expect(
        service.create(7, {
          lat: 45.42,
          lng: 28.2,
          firstName: 'Ion',
          photoId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should return the view for the creator (isFavorite false, creator rank, no inline logo)', async () => {
      repo.create.mockResolvedValue({ ...point, hasLogo: true });
      ranks.getRanks.mockResolvedValue(new Map([[7, 15]]));

      const view = await service.create(7, {
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
      });
      expect(view).not.toHaveProperty('logo');
      expect(repo.findFavoriteIds).toHaveBeenCalledWith(7, [point.id]);
    });
  });

  describe('read', () => {
    it('should list all points with the caller favorites and creator ranks', async () => {
      repo.findAll.mockResolvedValue([point, other]);
      repo.findFavoriteIds.mockResolvedValue(new Set([other.id]));
      ranks.getRanks.mockResolvedValue(new Map([[7, 980]]));

      const views = await service.findAll(VIEWER, { kind: 'head_office' });

      expect(repo.findAll).toHaveBeenCalledWith({
        kind: 'head_office',
        limit: 1000,
      });
      expect(repo.findFavoriteIds).toHaveBeenCalledWith(VIEWER, [
        point.id,
        other.id,
      ]);
      expect(ranks.getRanks).toHaveBeenCalledWith([7, 8]);
      expect(
        views.map(({ id, isFavorite, rank }) => ({ id, isFavorite, rank })),
      ).toEqual([
        { id: point.id, isFavorite: false, rank: 980 },
        // a creator without a computed rank gets 0
        { id: other.id, isFavorite: true, rank: 0 },
      ]);
    });

    it('should not query favorites or ranks for an empty list', async () => {
      repo.findAll.mockResolvedValue([]);
      await expect(service.findAll(VIEWER, {})).resolves.toEqual([]);
      expect(repo.findFavoriteIds).not.toHaveBeenCalled();
      expect(ranks.getRanks).not.toHaveBeenCalled();
    });

    it('should return any point by id with the caller view', async () => {
      repo.findById.mockResolvedValue(point);
      repo.findFavoriteIds.mockResolvedValue(new Set([point.id]));

      const view = await service.findById(VIEWER, point.id);

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

      const view = await service.findById(VIEWER, point.id);

      expect(view.hasLogo).toBe(true);
      expect(view.logoVersion).toBe(String(updatedAt.getTime()));
      expect(view).not.toHaveProperty('logo');
    });

    it('should return 404 when the point is missing or deleted', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(VIEWER, point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should pass only provided fields (incl. activities and logo) to update', async () => {
      repo.update.mockResolvedValue(point);

      await service.update(VIEWER, point.id, {
        kind: 'branch',
        activities: ['crewing'],
        logo: null,
        notes: null,
      });

      expect(repo.update).toHaveBeenCalledWith(point.id, {
        kind: 'branch',
        activities: ['crewing'],
        logo: null,
        notes: null,
      });
    });

    it('should allow clearing the activities', async () => {
      repo.update.mockResolvedValue(point);
      await service.update(VIEWER, point.id, { activities: [] });
      expect(repo.update).toHaveBeenCalledWith(point.id, { activities: [] });
    });

    it('should pass lastName "" and activity "" through, so the stored values are cleared', async () => {
      repo.update.mockResolvedValue(point);

      await service.update(VIEWER, point.id, {
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

    it('should return 422 premiumRequired for more than one activity', async () => {
      const error = await service
        .update(VIEWER, point.id, { activities: ['ship_agency', 'crewing'] })
        .catch((e: unknown) => e);

      expect(error).toMatchObject(premiumRequired);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should return 404 on update when the point does not exist', async () => {
      repo.update.mockResolvedValue(null);
      await expect(
        service.update(VIEWER, point.id, { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should return 404 on remove when the point does not exist', async () => {
      repo.remove.mockResolvedValue(false);
      await expect(service.remove(point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should remove any point by id', async () => {
      repo.remove.mockResolvedValue(true);
      await expect(service.remove(point.id)).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(point.id);
    });
  });

  describe('getLogo', () => {
    const pngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16, 3),
    ]);

    it('should decode the stored data URL into bytes with its MIME type', async () => {
      repo.findLogo.mockResolvedValue(
        `data:image/png;base64,${pngBytes.toString('base64')}`,
      );

      const logo = await service.getLogo(point.id);

      expect(repo.findLogo).toHaveBeenCalledWith(point.id);
      expect(logo.mimeType).toBe('image/png');
      expect(logo.bytes.equals(pngBytes)).toBe(true);
    });

    it('should return 404 when the point or its logo does not exist', async () => {
      repo.findLogo.mockResolvedValue(null);
      await expect(service.getLogo(point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return 404 rather than serve a stored value that is not an allowed image', async () => {
      repo.findLogo.mockResolvedValue(
        `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
      );
      await expect(service.getLogo(point.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('favorites', () => {
    it('should add to the caller favorites and stay idempotent', async () => {
      repo.exists.mockResolvedValue(true);

      await expect(
        service.setFavorite(VIEWER, point.id, true),
      ).resolves.toEqual({ isFavorite: true });
      await expect(
        service.setFavorite(VIEWER, point.id, true),
      ).resolves.toEqual({ isFavorite: true });

      expect(repo.addFavorite).toHaveBeenCalledTimes(2);
      expect(repo.addFavorite).toHaveBeenCalledWith(VIEWER, point.id);
      expect(repo.removeFavorite).not.toHaveBeenCalled();
    });

    it('should remove from the caller favorites, also when it was not a favorite', async () => {
      repo.exists.mockResolvedValue(true);

      await expect(
        service.setFavorite(String(VIEWER), point.id, false),
      ).resolves.toEqual({ isFavorite: false });

      expect(repo.removeFavorite).toHaveBeenCalledWith(VIEWER, point.id);
      expect(repo.addFavorite).not.toHaveBeenCalled();
    });

    it('should return 404 for a missing or deleted point', async () => {
      repo.exists.mockResolvedValue(false);

      await expect(
        service.setFavorite(VIEWER, point.id, true),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.setFavorite(VIEWER, point.id, false),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repo.addFavorite).not.toHaveBeenCalled();
      expect(repo.removeFavorite).not.toHaveBeenCalled();
    });
  });
});
