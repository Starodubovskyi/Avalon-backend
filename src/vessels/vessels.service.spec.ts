import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { RoleEnum } from '../roles/roles.enum';
import { VesselEventsService } from '../vessel-events/vessel-events.service';
import { Vessel } from './domain/vessel';
import { VesselRepository } from './infrastructure/persistence/vessel.repository';
import { VesselsService } from './vessels.service';

const VESSEL_ID = '22222222-2222-2222-2222-222222222222';
const STAFF = { userId: 7, roleId: RoleEnum.staff };

function buildVessel(overrides: Partial<Vessel> = {}): Vessel {
  return Object.assign(new Vessel(), {
    id: VESSEL_ID,
    name: 'TEST VESSEL SERVICE',
    imo: '9123456',
    mmsi: null,
    type: 'tanker',
    destination: 'RENI',
    condition: null,
    masterName: null,
    masterPhone: null,
    masterEmail: null,
    officeName: null,
    officePhone: null,
    officeEmail: null,
    portAgent: null,
    etaSulina: new Date('2026-11-01T10:00:00.000Z'),
    arrivedAt: null,
    inPortAt: null,
    departedAt: null,
    prearrivalsIn: 'not_ok',
    prearrivalsOut: 'not_ok',
    mswIn: false,
    mswOut: false,
    pdaSent: false,
    paid: false,
    t1: null,
    pilotageArranged: false,
    pilot: null,
    notes: null,
    lat: 45.2,
    lng: 29.6,
    sog: 7.5,
    cog: 120,
    positionSource: 'ais',
    positionAt: new Date('2026-10-30T09:00:00.000Z'),
    createdById: 1,
    updatedById: 1,
    updatedBy: null,
    createdAt: new Date('2026-10-29T00:00:00.000Z'),
    updatedAt: new Date('2026-10-29T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  });
}

describe('VesselsService', () => {
  let service: VesselsService;
  let repo: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByIdForUpdate: jest.Mock;
    existsWithImo: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let events: { record: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  const manager = {} as EntityManager;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue(buildVessel()),
      findByIdForUpdate: jest.fn().mockResolvedValue(buildVessel()),
      existsWithImo: jest.fn().mockResolvedValue(false),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(true),
      softDelete: jest.fn().mockResolvedValue(true),
    };
    events = { record: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: jest.fn(
        (work: (entityManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
    };
    service = new VesselsService(
      repo as unknown as VesselRepository,
      events as unknown as VesselEventsService,
      dataSource as unknown as DataSource,
    );
  });

  describe('update', () => {
    it('should write only changed fields and record the diff in the same transaction', async () => {
      repo.findById.mockResolvedValue(buildVessel({ pdaSent: true }));

      const view = await service.update(
        VESSEL_ID,
        {
          pdaSent: true,
          paid: false,
          name: 'TEST VESSEL SERVICE',
          etaSulina: '2026-11-01T10:00:00.000Z',
        },
        STAFF,
      );

      expect(repo.findByIdForUpdate).toHaveBeenCalledWith(VESSEL_ID, manager);
      expect(repo.update).toHaveBeenCalledWith(
        VESSEL_ID,
        { pdaSent: true, updatedById: 7 },
        manager,
      );
      expect(events.record).toHaveBeenCalledWith(manager, {
        vesselId: VESSEL_ID,
        vesselName: 'TEST VESSEL SERVICE',
        userId: 7,
        action: 'updated',
        changes: { pdaSent: { from: false, to: true } },
      });
      expect(view.pdaSent).toBe(true);
    });

    it('should compare dates as ISO strings and store them that way', async () => {
      repo.findById.mockResolvedValue(buildVessel());

      await service.update(
        VESSEL_ID,
        { arrivedAt: '2026-11-01T12:30:00.000Z', etaSulina: null },
        STAFF,
      );

      expect(events.record.mock.calls[0][1].changes).toEqual({
        etaSulina: { from: '2026-11-01T10:00:00.000Z', to: null },
        arrivedAt: { from: null, to: '2026-11-01T12:30:00.000Z' },
      });
      const patch = repo.update.mock.calls[0][1];
      expect(patch.arrivedAt).toEqual(new Date('2026-11-01T12:30:00.000Z'));
      expect(patch.etaSulina).toBeNull();
    });

    it('should skip the write and the event when nothing changed', async () => {
      repo.findById.mockResolvedValue(buildVessel());

      const view = await service.update(
        VESSEL_ID,
        { pdaSent: false, etaSulina: '2026-11-01T10:00:00.000Z' },
        STAFF,
      );

      expect(repo.findByIdForUpdate).toHaveBeenCalledTimes(1);
      expect(repo.update).not.toHaveBeenCalled();
      expect(events.record).not.toHaveBeenCalled();
      expect(view.id).toBe(VESSEL_ID);
    });

    it('should diff against the row read under lock, not a stale earlier read', async () => {
      // e.g. a concurrent edit committed notes "B" while this request waited
      repo.findById.mockResolvedValue(buildVessel({ notes: 'A' }));
      repo.findByIdForUpdate.mockResolvedValue(buildVessel({ notes: 'B' }));

      await service.update(VESSEL_ID, { notes: 'C' }, STAFF);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(events.record.mock.calls[0][1].changes).toEqual({
        notes: { from: 'B', to: 'C' },
      });
    });

    it('should mark a user-set position as manual and drop AIS speed/course', async () => {
      repo.findById.mockResolvedValue(buildVessel());

      await service.update(VESSEL_ID, { lat: 45.16, lng: 29.74 }, STAFF);

      const patch = repo.update.mock.calls[0][1];
      expect(patch).toMatchObject({
        lat: 45.16,
        lng: 29.74,
        positionSource: 'manual',
        sog: null,
        cog: null,
      });
      expect(patch.positionAt).toBeInstanceOf(Date);
      expect(events.record.mock.calls[0][1].changes).toEqual({
        lat: { from: 45.2, to: 45.16 },
        lng: { from: 29.6, to: 29.74 },
        positionSource: { from: 'ais', to: 'manual' },
      });
    });

    it('should reject a half-cleared position', async () => {
      repo.findById.mockResolvedValue(buildVessel());

      await expect(
        service.update(VESSEL_ID, { lat: null }, STAFF),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should return 422 imoAlreadyExists for a duplicate IMO', async () => {
      repo.findById.mockResolvedValue(buildVessel());
      repo.existsWithImo.mockResolvedValue(true);

      const error = await service
        .update(VESSEL_ID, { imo: '9999999' }, STAFF)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        status: 422,
        errors: { imo: 'imoAlreadyExists' },
      });
      expect(repo.existsWithImo).toHaveBeenCalledWith('9999999', VESSEL_ID);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should throw 404 for an unknown or deleted vessel', async () => {
      repo.findByIdForUpdate.mockResolvedValue(null);
      await expect(
        service.update(VESSEL_ID, { paid: true }, STAFF),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('should return 422 imoAlreadyExists when the IMO is taken', async () => {
      repo.existsWithImo.mockResolvedValue(true);

      const error = await service
        .create(
          {
            name: 'TEST VESSEL DUP',
            imo: '9123456',
            type: 'tanker',
            destination: 'RENI',
          },
          STAFF,
        )
        .catch((caught: unknown) => caught);

      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        status: 422,
        errors: { imo: 'imoAlreadyExists' },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should map a unique-index race on IMO to 422', async () => {
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'UQ_vessel_imo_active',
      });
      repo.create.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError),
      );

      const error = await service
        .create(
          {
            name: 'TEST VESSEL RACE',
            imo: '9123456',
            type: 'tanker',
            destination: 'RENI',
          },
          STAFF,
        )
        .catch((caught: unknown) => caught);

      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        status: 422,
        errors: { imo: 'imoAlreadyExists' },
      });
    });

    it('should apply defaults, manual position and a created event', async () => {
      const created = buildVessel({ id: VESSEL_ID });
      repo.create.mockResolvedValue(created);
      repo.findById.mockResolvedValue(created);

      await service.create(
        {
          name: 'TEST VESSEL NEW',
          type: 'livestock',
          destination: 'GALATI',
          pdaSent: true,
          lat: 45.1,
          lng: 29.7,
        },
        STAFF,
      );

      const data = repo.create.mock.calls[0][0];
      expect(data).toMatchObject({
        name: 'TEST VESSEL NEW',
        imo: null,
        prearrivalsIn: 'not_ok',
        mswIn: false,
        pdaSent: true,
        positionSource: 'manual',
        createdById: 7,
        updatedById: 7,
      });
      expect(repo.existsWithImo).not.toHaveBeenCalled();
      expect(events.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'created',
          changes: {
            name: { from: null, to: 'TEST VESSEL NEW' },
            type: { from: null, to: 'livestock' },
            destination: { from: null, to: 'GALATI' },
            pdaSent: { from: null, to: true },
            lat: { from: null, to: 45.1 },
            lng: { from: null, to: 29.7 },
          },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should soft delete and record a deleted event in one transaction', async () => {
      repo.findById.mockResolvedValue(buildVessel());

      await service.remove(VESSEL_ID, 1);

      expect(repo.findByIdForUpdate).toHaveBeenCalledWith(VESSEL_ID, manager);
      expect(repo.softDelete).toHaveBeenCalledWith(VESSEL_ID, 1, manager);
      expect(events.record).toHaveBeenCalledWith(manager, {
        vesselId: VESSEL_ID,
        vesselName: 'TEST VESSEL SERVICE',
        userId: 1,
        action: 'deleted',
        changes: {},
      });
    });
  });

  describe('findAll', () => {
    it('should redact vessels for viewers', async () => {
      repo.findAll.mockResolvedValue([buildVessel({ masterName: 'Capt.' })]);

      const [view] = await service.findAll({ scope: 'active' }, RoleEnum.user);

      expect(repo.findAll).toHaveBeenCalledWith({
        scope: 'active',
        search: undefined,
        limit: 500,
      });
      expect(view.restricted).toBe(true);
      expect(view.masterName).toBeNull();
    });
  });
});
