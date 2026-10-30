import { ConflictException, NotFoundException } from '@nestjs/common';
import { PortsService } from './ports.service';
import { PortRepository } from './infrastructure/persistence/port.repository';
import { Port } from './domain/port';
import { PortOperationalStatus } from './port-status.enum';

describe('PortsService', () => {
  let service: PortsService;
  let repo: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    findByUnlocode: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const port: Port = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Constanța',
    unlocode: 'ROCND',
    country: 'RO',
    status: PortOperationalStatus.OPEN,
    timezone: 'Europe/Bucharest',
    lat: 44.1598,
    lng: 28.6348,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUnlocode: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    service = new PortsService(repo as unknown as PortRepository);
  });

  it('should create a catalog port with normalized UN/LOCODE', async () => {
    repo.findByUnlocode.mockResolvedValue(null);
    repo.create.mockResolvedValue(port);

    await service.create({
      name: 'Constanța',
      unlocode: 'ROCND',
      country: 'RO',
      status: PortOperationalStatus.OPEN,
      timezone: 'Europe/Bucharest',
      lat: 44.1598,
      lng: 28.6348,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Constanța',
        unlocode: 'ROCND',
        country: 'RO',
        status: PortOperationalStatus.OPEN,
      }),
    );
  });

  it('should reject a duplicate UN/LOCODE', async () => {
    repo.findByUnlocode.mockResolvedValue(port);
    await expect(
      service.create({
        name: 'Another',
        unlocode: 'ROCND',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when id is missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update an existing port', async () => {
    repo.findById.mockResolvedValue(port);
    repo.update.mockResolvedValue({ ...port, name: 'Constanta Port' });

    const updated = await service.update(port.id, { name: 'Constanta Port' });

    expect(updated.name).toBe('Constanta Port');
    expect(repo.update).toHaveBeenCalledWith(
      port.id,
      expect.objectContaining({ name: 'Constanta Port' }),
    );
  });
});
