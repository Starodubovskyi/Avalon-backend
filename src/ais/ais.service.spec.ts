import { DataSource, EntityManager } from 'typeorm';
import { VesselEventsService } from '../vessel-events/vessel-events.service';
import { AisTrackedVessel } from '../vessels/domain/vessel';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import { MmsiBindingConfirmer } from './ais-mmsi-binding';
import { AisService } from './ais.service';

const VESSEL_ID = '33333333-3333-3333-3333-333333333333';
const MINUTE = 60_000;

function position(lat: number, lng: number, mmsi = 271000123): string {
  return JSON.stringify({
    MessageType: 'PositionReport',
    Message: {
      PositionReport: {
        UserID: mmsi,
        Latitude: lat,
        Longitude: lng,
        Sog: 8,
        Cog: 90,
      },
    },
  });
}

function shipStatic(imo: number, mmsi: number): string {
  return JSON.stringify({
    MessageType: 'ShipStaticData',
    Message: { ShipStaticData: { UserID: mmsi, ImoNumber: imo } },
  });
}

function trackedVessel(
  overrides: Partial<AisTrackedVessel> = {},
): AisTrackedVessel {
  return {
    id: VESSEL_ID,
    name: 'TEST VESSEL AIS',
    imo: '9123456',
    mmsi: null,
    lat: null,
    lng: null,
    positionAt: null,
    positionSource: null,
    ...overrides,
  };
}

const at = (base: Date, offsetMs: number) =>
  new Date(base.getTime() + offsetMs);

describe('MmsiBindingConfirmer', () => {
  it('should confirm only a consistent second observation after the delay', () => {
    const confirmer = new MmsiBindingConfirmer(2 * MINUTE);
    expect(confirmer.observe('v', '271000123', 0)).toBe(false);
    expect(confirmer.observe('v', '271000123', MINUTE)).toBe(false);
    expect(confirmer.observe('v', '271000123', 2 * MINUTE)).toBe(true);
  });

  it('should restart the wait when a different MMSI claims the IMO', () => {
    const confirmer = new MmsiBindingConfirmer(2 * MINUTE);
    confirmer.observe('v', '271000123', 0);
    expect(confirmer.observe('v', '271999999', 3 * MINUTE)).toBe(false);
    expect(confirmer.observe('v', '271000123', 4 * MINUTE)).toBe(false);
    expect(confirmer.observe('v', '271000123', 6 * MINUTE)).toBe(true);
  });
});

describe('AisService', () => {
  const originalKey = process.env.AISSTREAM_API_KEY;
  const manager = {} as EntityManager;
  let repo: {
    findActiveForAis: jest.Mock;
    assignMmsiIfEmpty: jest.Mock;
    updateAisPosition: jest.Mock;
  };
  let events: { record: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    repo = {
      findActiveForAis: jest.fn().mockResolvedValue([trackedVessel()]),
      assignMmsiIfEmpty: jest.fn().mockResolvedValue(true),
      updateAisPosition: jest.fn().mockResolvedValue(undefined),
    };
    events = { record: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: jest.fn(
        (work: (entityManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
    };
  });

  afterEach(() => {
    process.env.AISSTREAM_API_KEY = originalKey;
  });

  function createService(apiKey = ''): AisService {
    process.env.AISSTREAM_API_KEY = apiKey;
    return new AisService(
      repo as unknown as VesselRepository,
      events as unknown as VesselEventsService,
      dataSource as unknown as DataSource,
    );
  }

  it('should never start on serverless (VERCEL), even with a key', () => {
    const originalVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
      const service = createService('test-key');
      service.onModuleInit();
      expect(service.getStatus()).toMatchObject({
        enabled: false,
        connected: false,
      });
      expect(repo.findActiveForAis).not.toHaveBeenCalled();
    } finally {
      if (originalVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = originalVercel;
      }
    }
  });

  it('should stay disabled without an API key and not touch the DB', () => {
    const service = createService('');
    service.onModuleInit();

    expect(service.getStatus()).toEqual({
      enabled: false,
      connected: false,
      lastMessageAt: null,
      trackedVessels: 0,
    });
    expect(repo.findActiveForAis).not.toHaveBeenCalled();
  });

  it('should bind MMSI only after two consistent ShipStaticData >= 2 min apart, with a system audit event', async () => {
    const service = createService('test-key');
    await service.reloadVessels();
    const t0 = new Date('2026-10-30T10:00:00.000Z');

    await service.handleFrame(shipStatic(9123456, 271000123), t0);
    await service.handleFrame(shipStatic(9123456, 271000123), at(t0, MINUTE));
    expect(repo.assignMmsiIfEmpty).not.toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();

    await service.handleFrame(
      shipStatic(9123456, 271000123),
      at(t0, 2 * MINUTE),
    );
    expect(repo.assignMmsiIfEmpty).toHaveBeenCalledWith(
      VESSEL_ID,
      '271000123',
      manager,
    );
    expect(events.record).toHaveBeenCalledWith(manager, {
      vesselId: VESSEL_ID,
      vesselName: 'TEST VESSEL AIS',
      userId: null,
      action: 'updated',
      changes: { mmsi: { from: null, to: '271000123' } },
    });

    // once bound, further static frames do nothing
    await service.handleFrame(
      shipStatic(9123456, 271000123),
      at(t0, 5 * MINUTE),
    );
    expect(repo.assignMmsiIfEmpty).toHaveBeenCalledTimes(1);
  });

  it('should not bind on conflicting MMSI claims for the same IMO', async () => {
    const service = createService('test-key');
    await service.reloadVessels();
    const t0 = new Date('2026-10-30T10:00:00.000Z');

    await service.handleFrame(shipStatic(9123456, 271000123), t0);
    await service.handleFrame(
      shipStatic(9123456, 271999999),
      at(t0, 3 * MINUTE),
    );

    expect(repo.assignMmsiIfEmpty).not.toHaveBeenCalled();
  });

  it('should not record an audit event when the MMSI was filled meanwhile', async () => {
    repo.assignMmsiIfEmpty.mockResolvedValue(false);
    const service = createService('test-key');
    await service.reloadVessels();
    const t0 = new Date('2026-10-30T10:00:00.000Z');

    await service.handleFrame(shipStatic(9123456, 271000123), t0);
    await service.handleFrame(
      shipStatic(9123456, 271000123),
      at(t0, 2 * MINUTE),
    );

    expect(repo.assignMmsiIfEmpty).toHaveBeenCalledTimes(1);
    expect(events.record).not.toHaveBeenCalled();
  });

  it('should store throttled, plausible positions without audit', async () => {
    repo.findActiveForAis.mockResolvedValue([
      trackedVessel({ mmsi: '271000123' }),
    ]);
    const service = createService('test-key');
    await service.reloadVessels();
    const t0 = new Date('2026-10-30T10:00:00.000Z');

    // unknown MMSI → ignored
    await service.handleFrame(position(45.15, 29.66, 271555555), t0);
    expect(repo.updateAisPosition).not.toHaveBeenCalled();

    await service.handleFrame(position(45.15, 29.66), t0);
    expect(repo.updateAisPosition).toHaveBeenCalledWith(VESSEL_ID, {
      lat: 45.15,
      lng: 29.66,
      sog: 8,
      cog: 90,
      positionAt: t0,
    });

    // within 60 s → throttled
    await service.handleFrame(position(45.151, 29.661), at(t0, 30_000));
    expect(repo.updateAisPosition).toHaveBeenCalledTimes(1);

    // after 60 s, a spoofed 30 nm jump → dropped
    await service.handleFrame(position(45.65, 29.66), at(t0, 61_000));
    expect(repo.updateAisPosition).toHaveBeenCalledTimes(1);

    // plausible move → stored
    await service.handleFrame(position(45.16, 29.66), at(t0, 2 * MINUTE));
    expect(repo.updateAisPosition).toHaveBeenCalledTimes(2);
    expect(events.record).not.toHaveBeenCalled();

    const status = service.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.trackedVessels).toBe(1);
    expect(status.lastMessageAt).toBe(at(t0, 2 * MINUTE).toISOString());
  });

  it('should not overwrite an existing MMSI and ignore IMO 0', async () => {
    repo.findActiveForAis.mockResolvedValue([
      trackedVessel({ mmsi: '271999999' }),
    ]);
    const service = createService('test-key');
    await service.reloadVessels();
    const t0 = new Date('2026-10-30T10:00:00.000Z');

    for (const offset of [0, 3 * MINUTE]) {
      await service.handleFrame(shipStatic(9123456, 271000123), at(t0, offset));
      await service.handleFrame(shipStatic(0, 271000123), at(t0, offset));
    }

    expect(repo.assignMmsiIfEmpty).not.toHaveBeenCalled();
  });

  it('should swallow repository failures', async () => {
    repo.findActiveForAis.mockRejectedValue(new Error('db down'));
    const service = createService('test-key');

    await expect(service.reloadVessels()).resolves.toBeUndefined();
    await expect(
      service.handleFrame('{"error":"Api Key Is Not Valid"}', new Date()),
    ).resolves.toBeUndefined();
  });
});
