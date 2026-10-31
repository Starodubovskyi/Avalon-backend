import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { RoleEnum } from '../roles/roles.enum';
import { NetworkActor } from '../users-directory/user-visibility';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import { AgencyRequestsService } from './agency-requests.service';
import {
  AgencyRequest,
  AgencyRequestPatch,
  NewAgencyRequest,
} from './domain/agency-request';
import { CreateAgencyRequestDto } from './dto/create-agency-request.dto';
import { UpdateAgencyRequestDto } from './dto/update-agency-request.dto';
import {
  AgencyRequestListFilter,
  AgencyRequestRepository,
} from './infrastructure/persistence/agency-request.repository';

const VESSEL_ID = '22222222-2222-2222-2222-222222222222';
const UNKNOWN_ID = '99999999-9999-9999-9999-999999999999';
const ADMIN: NetworkActor = { userId: 1, roleId: RoleEnum.admin };
const STAFF: NetworkActor = { userId: 7, roleId: RoleEnum.staff };
const VIEWER_A: NetworkActor = { userId: 21, roleId: RoleEnum.user };
const VIEWER_B: NetworkActor = { userId: 22, roleId: RoleEnum.user };

/**
 * Bodies go through plainToInstance like the global ValidationPipe
 * (transform: true), so the DTO transforms the service relies on run here.
 */
function buildDto(
  overrides: Record<string, unknown> = {},
): CreateAgencyRequestDto {
  return plainToInstance(CreateAgencyRequestDto, {
    company: 'Test Agency Spec Ltd',
    contactName: 'Test Contact',
    email: 'test.agency.spec@example.com',
    vesselName: 'MV Test Spec',
    vesselType: 'tanker',
    destination: 'GALATI',
    ...overrides,
  });
}

function updateDto(plain: Record<string, unknown>): UpdateAgencyRequestDto {
  return plainToInstance(UpdateAgencyRequestDto, plain);
}

/**
 * In-memory stand-in honouring the repository contract: createdById !== null
 * restricts reads to that author, newest first.
 */
class InMemoryAgencyRequestRepository {
  readonly rows: (AgencyRequest & { createdById: number })[] = [];
  private sequence = 0;

  create = jest.fn((data: NewAgencyRequest): Promise<string> => {
    this.sequence += 1;
    const id = `00000000-0000-0000-0000-${String(this.sequence).padStart(12, '0')}`;
    const at = new Date(Date.UTC(2026, 9, 31, 10, this.sequence)).toISOString();
    this.rows.push({
      id,
      status: 'new',
      company: data.company,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      vesselName: data.vesselName,
      imo: data.imo,
      vesselType: data.vesselType,
      destination: data.destination,
      eta: data.eta?.toISOString() ?? null,
      cargo: data.cargo,
      notes: data.notes,
      staffNote: null,
      vesselId: null,
      createdById: data.createdById,
      createdBy: {
        id: data.createdById,
        firstName: null,
        lastName: null,
        email: null,
      },
      createdAt: at,
      updatedAt: at,
    });
    return Promise.resolve(id);
  });

  findMany = jest.fn(
    (filter: AgencyRequestListFilter): Promise<AgencyRequest[]> =>
      Promise.resolve(
        this.rows
          .filter(
            (row) =>
              (filter.createdById === null ||
                row.createdById === filter.createdById) &&
              (!filter.status || row.status === filter.status),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, filter.limit),
      ),
  );

  findOne = jest.fn(
    (id: string, createdById: number | null): Promise<AgencyRequest | null> =>
      Promise.resolve(
        this.rows.find(
          (row) =>
            row.id === id &&
            (createdById === null || row.createdById === createdById),
        ) ?? null,
      ),
  );

  update = jest.fn(
    (id: string, patch: AgencyRequestPatch): Promise<boolean> => {
      const row = this.rows.find((candidate) => candidate.id === id);
      if (!row) {
        return Promise.resolve(false);
      }
      Object.assign(row, patch);
      return Promise.resolve(true);
    },
  );
}

describe('AgencyRequestsService', () => {
  let service: AgencyRequestsService;
  let requests: InMemoryAgencyRequestRepository;
  let vessels: { findById: jest.Mock };

  beforeEach(() => {
    requests = new InMemoryAgencyRequestRepository();
    vessels = {
      findById: jest.fn((id: string) =>
        Promise.resolve(id === VESSEL_ID ? { id } : null),
      ),
    };
    service = new AgencyRequestsService(
      requests as unknown as AgencyRequestRepository,
      vessels as unknown as VesselRepository,
    );
  });

  describe('create', () => {
    it('should store trimmed values, an upper-cased vessel name and nulls for blank or omitted optionals', async () => {
      await service.create(
        buildDto({
          company: '  Test Agency Spec Ltd ',
          contactName: ' Test Contact ',
          email: ' test.agency.spec@example.com ',
          phone: '   ',
          vesselName: '  mv test straße  ',
          imo: ' 9123456 ',
          eta: '2026-11-05T08:00:00.000Z',
          notes: '  Draft 7.2 m  ',
        }),
        VIEWER_A,
      );

      expect(requests.create).toHaveBeenCalledWith({
        createdById: VIEWER_A.userId,
        company: 'Test Agency Spec Ltd',
        contactName: 'Test Contact',
        email: 'test.agency.spec@example.com',
        phone: null,
        vesselName: 'MV TEST STRASSE',
        imo: '9123456',
        vesselType: 'tanker',
        destination: 'GALATI',
        eta: new Date('2026-11-05T08:00:00.000Z'),
        cargo: null,
        notes: 'Draft 7.2 m',
      });
    });

    it('should take the author from the actor and return the new request with status new', async () => {
      const created = await service.create(buildDto(), VIEWER_A);

      expect(created.status).toBe('new');
      expect(created.createdBy?.id).toBe(VIEWER_A.userId);
      expect(created.eta).toBeNull();
      expect(requests.findOne).toHaveBeenCalledWith(
        created.id,
        VIEWER_A.userId,
      );
    });
  });

  describe('visibility', () => {
    let ownA: AgencyRequest;
    let ownB: AgencyRequest;

    beforeEach(async () => {
      ownA = await service.create(buildDto(), VIEWER_A);
      ownB = await service.create(buildDto(), VIEWER_B);
    });

    it('should list only the viewer’s own requests, filtered by the repository', async () => {
      const list = await service.findAll({}, VIEWER_A);

      expect(list.map((request) => request.id)).toEqual([ownA.id]);
      expect(requests.findMany).toHaveBeenCalledWith({
        createdById: VIEWER_A.userId,
        status: undefined,
        limit: 200,
      });
    });

    it('should list every request for staff and admin, newest first', async () => {
      for (const actor of [STAFF, ADMIN]) {
        const list = await service.findAll({}, actor);
        expect(list.map((request) => request.id)).toEqual([ownB.id, ownA.id]);
      }
      expect(requests.findMany).toHaveBeenLastCalledWith({
        createdById: null,
        status: undefined,
        limit: 200,
      });
    });

    it('should pass the status filter through', async () => {
      await service.update(ownA.id, { status: 'quoted' }, STAFF);

      await expect(
        service.findAll({ status: 'quoted' }, STAFF),
      ).resolves.toEqual([expect.objectContaining({ id: ownA.id })]);
      await expect(
        service.findAll({ status: 'quoted' }, VIEWER_B),
      ).resolves.toEqual([]);
    });

    it('should return the viewer’s own request by id', async () => {
      await expect(service.findById(ownA.id, VIEWER_A)).resolves.toEqual(
        expect.objectContaining({ id: ownA.id }),
      );
    });

    it('should answer 404 when a viewer asks for another user’s request', async () => {
      await expect(service.findById(ownA.id, VIEWER_B)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(requests.findOne).toHaveBeenLastCalledWith(
        ownA.id,
        VIEWER_B.userId,
      );
    });

    it('should let staff read any request and answer 404 for an unknown id', async () => {
      await expect(service.findById(ownB.id, STAFF)).resolves.toEqual(
        expect.objectContaining({ id: ownB.id }),
      );
      await expect(service.findById(UNKNOWN_ID, STAFF)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    let request: AgencyRequest;

    beforeEach(async () => {
      request = await service.create(buildDto(), VIEWER_A);
    });

    it('should reject a viewer with 403 without touching storage', async () => {
      await expect(
        service.update(request.id, { status: 'accepted' }, VIEWER_A),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(requests.update).not.toHaveBeenCalled();
      expect(vessels.findById).not.toHaveBeenCalled();
    });

    it('should let staff set status and a trimmed note the viewer then sees', async () => {
      const updated = await service.update(
        request.id,
        updateDto({ status: 'quoted', staffNote: '  PDA sent, EUR 4 200  ' }),
        STAFF,
      );

      expect(requests.update).toHaveBeenCalledWith(request.id, {
        status: 'quoted',
        staffNote: 'PDA sent, EUR 4 200',
      });
      expect(updated).toEqual(
        expect.objectContaining({
          status: 'quoted',
          staffNote: 'PDA sent, EUR 4 200',
        }),
      );
      await expect(service.findById(request.id, VIEWER_A)).resolves.toEqual(
        expect.objectContaining({
          status: 'quoted',
          staffNote: 'PDA sent, EUR 4 200',
        }),
      );
    });

    it('should accept with a vesselId that exists', async () => {
      const updated = await service.update(
        request.id,
        { status: 'accepted', vesselId: VESSEL_ID },
        ADMIN,
      );

      expect(vessels.findById).toHaveBeenCalledWith(VESSEL_ID);
      expect(updated).toEqual(
        expect.objectContaining({ status: 'accepted', vesselId: VESSEL_ID }),
      );
    });

    it('should answer 422 { vesselId: notFound } for an unknown vessel', async () => {
      const error: unknown = await service
        .update(request.id, { status: 'accepted', vesselId: UNKNOWN_ID }, STAFF)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        status: 422,
        errors: { vesselId: 'notFound' },
      });
      expect(requests.update).not.toHaveBeenCalled();
    });

    it('should clear the note and unlink the vessel with null or blank values', async () => {
      await service.update(
        request.id,
        { staffNote: 'note', vesselId: VESSEL_ID },
        STAFF,
      );

      await service.update(
        request.id,
        updateDto({ staffNote: '   ', vesselId: null }),
        STAFF,
      );

      expect(requests.update).toHaveBeenLastCalledWith(request.id, {
        staffNote: null,
        vesselId: null,
      });
      expect(vessels.findById).toHaveBeenCalledTimes(1);
    });

    it('should not write an empty patch but still return the request', async () => {
      await expect(service.update(request.id, {}, STAFF)).resolves.toEqual(
        expect.objectContaining({ id: request.id }),
      );
      expect(requests.update).not.toHaveBeenCalled();
    });

    it('should answer 404 for an unknown request', async () => {
      await expect(
        service.update(UNKNOWN_ID, { status: 'declined' }, STAFF),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
