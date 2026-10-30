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
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let files: { findById: jest.Mock };

  const point: MapPoint = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 7,
    kind: 'company',
    lat: 45.42,
    lng: 28.2,
    firstName: 'Avalon Shipping',
    lastName: '',
    activity: 'Port agent',
    phone: null,
    email: null,
    address: null,
    notes: null,
    photoId: null,
    isFavorite: false,
    createdBy: { id: 7, firstName: 'Ion', lastName: 'Popescu', email: null },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    files = { findById: jest.fn() };
    service = new MapPointsService(
      repo as unknown as MapPointRepository,
      files as unknown as FilesService,
    );
  });

  it('should create with the JWT user as creator and default kind person', async () => {
    repo.create.mockResolvedValue(point);
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
        kind: 'person',
        firstName: 'Ion',
        notes: null,
        isFavorite: false,
        photoId: null,
      }),
    );
  });

  it('should keep the requested kind and notes on create', async () => {
    repo.create.mockResolvedValue(point);

    await service.create(7, {
      lat: 45.42,
      lng: 28.2,
      firstName: 'Avalon Shipping',
      kind: 'company',
      notes: 'Main office',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'company', notes: 'Main office' }),
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

  it('should list all team points with the kind filter and the 1000 cap', async () => {
    repo.findAll.mockResolvedValue([point]);

    await expect(service.findAll({ kind: 'company' })).resolves.toEqual([
      point,
    ]);
    expect(repo.findAll).toHaveBeenCalledWith({ kind: 'company', limit: 1000 });

    await service.findAll({});
    expect(repo.findAll).toHaveBeenLastCalledWith({
      kind: undefined,
      limit: 1000,
    });
  });

  it('should return any point by id regardless of creator', async () => {
    repo.findById.mockResolvedValue(point);
    await expect(service.findById(point.id)).resolves.toBe(point);
    expect(repo.findById).toHaveBeenCalledWith(point.id);
  });

  it('should return 404 when the point is missing or deleted', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById(point.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should pass only provided fields (incl. kind and notes) to update', async () => {
    repo.update.mockResolvedValue({ ...point, kind: 'employee' });

    await service.update(point.id, { kind: 'employee', notes: null });

    expect(repo.update).toHaveBeenCalledWith(point.id, {
      kind: 'employee',
      notes: null,
    });
  });

  it('should return 404 on update when the point does not exist', async () => {
    repo.update.mockResolvedValue(null);
    await expect(
      service.update(point.id, { isFavorite: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

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
