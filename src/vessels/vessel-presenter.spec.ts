import { RoleEnum } from '../roles/roles.enum';
import { Vessel } from './domain/vessel';
import {
  computeChecklist,
  computeStage,
  isUnpaidAfterDeparture,
  toVesselView,
} from './vessel-presenter';

function buildVessel(overrides: Partial<Vessel> = {}): Vessel {
  return Object.assign(new Vessel(), {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'TEST VESSEL PRESENTER',
    imo: '9123456',
    mmsi: null,
    type: 'general_cargo',
    destination: 'IZMAIL',
    condition: 'loaded',
    masterName: 'Capt. Ion',
    masterPhone: '+40 700 000 000',
    masterEmail: 'master@example.com',
    officeName: 'Owner Ltd',
    officePhone: '+30 210 000 000',
    officeEmail: 'office@example.com',
    portAgent: 'Avalon',
    etaSulina: new Date('2026-10-30T08:00:00.000Z'),
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
    notes: 'internal note',
    lat: 45.15,
    lng: 29.75,
    sog: 8.2,
    cog: 270,
    positionSource: 'ais',
    positionAt: new Date('2026-10-30T09:00:00.000Z'),
    createdById: 1,
    updatedById: 1,
    updatedBy: { id: 1, firstName: 'Ad', lastName: 'Min', email: 'a@x.io' },
    createdAt: new Date('2026-10-29T00:00:00.000Z'),
    updatedAt: new Date('2026-10-30T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  });
}

describe('vessel-presenter', () => {
  describe('computeStage', () => {
    it('should be expected without arrival dates', () => {
      expect(computeStage(buildVessel())).toBe('expected');
    });

    it('should be at_roads when only arrivedAt is set', () => {
      expect(computeStage(buildVessel({ arrivedAt: new Date() }))).toBe(
        'at_roads',
      );
    });

    it('should be in_port when inPortAt is set and not departed', () => {
      expect(
        computeStage(
          buildVessel({ arrivedAt: new Date(), inPortAt: new Date() }),
        ),
      ).toBe('in_port');
    });

    it('should be departed whenever departedAt is set', () => {
      expect(
        computeStage(
          buildVessel({ inPortAt: new Date(), departedAt: new Date() }),
        ),
      ).toBe('departed');
    });
  });

  describe('computeChecklist', () => {
    it('should list all 8 items as pending for a fresh vessel', () => {
      const checklist = computeChecklist(buildVessel());
      expect(checklist).toEqual({
        done: 0,
        total: 8,
        pending: [
          'prearrivalsIn',
          'mswIn',
          'pdaSent',
          't1',
          'pilotageArranged',
          'paid',
          'prearrivalsOut',
          'mswOut',
        ],
      });
    });

    it('should count ok statuses, booleans and t1 not_needed as done', () => {
      const checklist = computeChecklist(
        buildVessel({
          prearrivalsIn: 'ok',
          mswIn: true,
          pdaSent: true,
          t1: 'not_needed',
          pilotageArranged: true,
          paid: true,
          prearrivalsOut: 'ok',
          mswOut: true,
        }),
      );
      expect(checklist.done).toBe(8);
      expect(checklist.pending).toEqual([]);
    });

    it('should keep t1=no as pending', () => {
      expect(computeChecklist(buildVessel({ t1: 'no' })).pending).toContain(
        't1',
      );
      expect(
        computeChecklist(buildVessel({ t1: 'yes' })).pending,
      ).not.toContain('t1');
    });
  });

  describe('isUnpaidAfterDeparture', () => {
    it('should flag departed and unpaid vessels only', () => {
      expect(isUnpaidAfterDeparture(buildVessel())).toBe(false);
      expect(
        isUnpaidAfterDeparture(buildVessel({ departedAt: new Date() })),
      ).toBe(true);
      expect(
        isUnpaidAfterDeparture(
          buildVessel({ departedAt: new Date(), paid: true }),
        ),
      ).toBe(false);
    });
  });

  describe('toVesselView', () => {
    it('should expose internal fields to staff and admin', () => {
      for (const role of [RoleEnum.admin, RoleEnum.staff]) {
        const view = toVesselView(buildVessel(), role);
        expect(view.restricted).toBe(false);
        expect(view.masterName).toBe('Capt. Ion');
        expect(view.notes).toBe('internal note');
        expect(view.checklist?.total).toBe(8);
        expect(view.unpaidAfterDeparture).toBe(false);
        expect(view.updatedBy?.id).toBe(1);
      }
    });

    it('should null internal fields for viewers and unknown roles', () => {
      for (const role of [RoleEnum.user, undefined, null, 99]) {
        const view = toVesselView(buildVessel({ paid: true }), role);
        expect(view.restricted).toBe(true);
        expect(view).toMatchObject({
          masterName: null,
          masterPhone: null,
          masterEmail: null,
          officeName: null,
          officePhone: null,
          officeEmail: null,
          portAgent: null,
          prearrivalsIn: null,
          prearrivalsOut: null,
          mswIn: null,
          mswOut: null,
          pdaSent: null,
          paid: null,
          t1: null,
          pilotageArranged: null,
          pilot: null,
          notes: null,
          checklist: null,
          unpaidAfterDeparture: null,
          updatedBy: null,
        });
      }
    });

    it('should keep public fields and ISO dates for viewers', () => {
      const view = toVesselView(buildVessel(), RoleEnum.user);
      expect(view).toMatchObject({
        name: 'TEST VESSEL PRESENTER',
        imo: '9123456',
        destination: 'IZMAIL',
        lat: 45.15,
        lng: 29.75,
        positionSource: 'ais',
        stage: 'expected',
        etaSulina: '2026-10-30T08:00:00.000Z',
        createdAt: '2026-10-29T00:00:00.000Z',
      });
    });
  });
});
