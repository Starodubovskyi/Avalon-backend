import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MapPointsService } from './map-points.service';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import { FilesService } from '../files/files.service';
import { MapPoint } from './domain/map-point';
import { CreateMapPointDto } from './dto/create-map-point.dto';

describe('MapPointsService', () => {
  let service: MapPointsService;
  let repo: {
    create: jest.Mock;
    findAllByUserId: jest.Mock;
    findByIdForUser: jest.Mock;
    updateForUser: jest.Mock;
    removeForUser: jest.Mock;
  };
  let files: { findById: jest.Mock };

  const owned: MapPoint = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 7,
    lat: 45.42,
    lng: 28.2,
    firstName: 'Ion',
    lastName: 'Popescu',
    activity: 'Port agent',
    phone: null,
    email: null,
    address: null,
    photoId: null,
    isFavorite: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAllByUserId: jest.fn(),
      findByIdForUser: jest.fn(),
      updateForUser: jest.fn(),
      removeForUser: jest.fn(),
    };
    files = { findById: jest.fn() };
    service = new MapPointsService(
      repo as unknown as MapPointRepository,
      files as unknown as FilesService,
    );
  });

  it('should create with JWT user id, not a body owner', async () => {
    repo.create.mockResolvedValue(owned);
    const dto: CreateMapPointDto = {
      lat: 45.42,
      lng: 28.2,
      firstName: 'Ion',
      lastName: 'Popescu',
      activity: 'Port agent',
    };

    await service.create(7, dto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        firstName: 'Ion',
        isFavorite: false,
        photoId: null,
      }),
    );
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

  it('should list only the current user points', async () => {
    repo.findAllByUserId.mockResolvedValue([owned]);
    await expect(service.findAllForUser(7)).resolves.toEqual([owned]);
    expect(repo.findAllByUserId).toHaveBeenCalledWith(7);
  });

  it('should return 404 when the row is missing or owned by someone else', async () => {
    repo.findByIdForUser.mockResolvedValue(null);
    await expect(service.findByIdForUser(owned.id, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should return 404 on update when the repository finds nothing for this user', async () => {
    repo.updateForUser.mockResolvedValue(null);
    await expect(
      service.update(owned.id, 7, { isFavorite: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should return 404 on remove when the repository finds nothing for this user', async () => {
    repo.removeForUser.mockResolvedValue(false);
    await expect(service.remove(owned.id, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
