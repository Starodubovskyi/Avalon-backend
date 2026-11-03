import { Repository } from 'typeorm';
import { MapPointEntity } from '../entities/map-point.entity';
import { MapPointFavoriteEntity } from '../entities/map-point-favorite.entity';
import { MapPointRelationalRepository } from './map-point.repository';

/** Stored row as TypeORM loads it: `logo` is select: false (not loaded). */
function storedPoint(): MapPointEntity {
  return Object.assign(new MapPointEntity(), {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 7,
    kind: 'private_person',
    lat: 45.42,
    lng: 28.2,
    firstName: 'Ion',
    lastName: 'Popescu',
    activity: 'Port agent',
    activities: ['ship_agency'],
    hasLogo: true,
    phone: '+40 721 000 000',
    email: null,
    address: null,
    notes: null,
    photoId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  });
}

describe('MapPointRelationalRepository.update', () => {
  let points: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let repository: MapPointRelationalRepository;

  beforeEach(() => {
    const query = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(storedPoint()),
    };
    points = {
      findOne: jest.fn().mockResolvedValue(storedPoint()),
      create: jest.fn((entity: MapPointEntity) => entity),
      save: jest.fn((entity: MapPointEntity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(() => query),
    };
    repository = new MapPointRelationalRepository(
      points as unknown as Repository<MapPointEntity>,
      {} as Repository<MapPointFavoriteEntity>,
    );
  });

  const saved = (): MapPointEntity =>
    (points.save.mock.calls[0] as [MapPointEntity])[0];

  it('should clear the stored lastName and activity when "" is sent', async () => {
    await repository.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      firstName: 'Ion Popescu',
      lastName: '',
      activity: '',
    });

    expect(saved()).toMatchObject({
      firstName: 'Ion Popescu',
      lastName: '',
      activity: '',
    });
  });

  it('should keep fields that are not sent, and the creator', async () => {
    await repository.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      kind: 'head_office',
    });

    expect(saved()).toMatchObject({
      userId: 7,
      kind: 'head_office',
      firstName: 'Ion',
      lastName: 'Popescu',
      activity: 'Port agent',
      activities: ['ship_agency'],
      phone: '+40 721 000 000',
    });
  });

  it('should leave the stored logo alone unless one is sent; null removes it', async () => {
    await repository.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      firstName: 'X',
    });
    expect(saved()).not.toHaveProperty('logo');

    points.save.mockClear();
    await repository.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      logo: null,
    });
    expect(saved()).toHaveProperty('logo', null);

    points.save.mockClear();
    await repository.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      logo: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(saved()).toHaveProperty(
      'logo',
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('should return null (→ 404) when the point does not exist', async () => {
    points.findOne.mockResolvedValue(null);
    await expect(
      repository.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        lastName: '',
      }),
    ).resolves.toBeNull();
    expect(points.save).not.toHaveBeenCalled();
  });
});
