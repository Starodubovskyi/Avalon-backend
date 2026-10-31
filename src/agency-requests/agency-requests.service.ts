import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isTeamRole, NetworkActor } from '../users-directory/user-visibility';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import { AGENCY_REQUEST_LIST_LIMIT } from './agency-requests.constants';
import {
  AgencyRequest,
  AgencyRequestPatch,
  NewAgencyRequest,
} from './domain/agency-request';
import { CreateAgencyRequestDto } from './dto/create-agency-request.dto';
import { QueryAgencyRequestDto } from './dto/query-agency-request.dto';
import { UpdateAgencyRequestDto } from './dto/update-agency-request.dto';
import { AgencyRequestRepository } from './infrastructure/persistence/agency-request.repository';

@Injectable()
export class AgencyRequestsService {
  constructor(
    private readonly requestRepository: AgencyRequestRepository,
    private readonly vesselRepository: VesselRepository,
  ) {}

  /** Any signed-in user; the author is always the caller (JWT). */
  async create(
    dto: CreateAgencyRequestDto,
    actor: NetworkActor,
  ): Promise<AgencyRequest> {
    const id = await this.requestRepository.create(
      toNewAgencyRequest(dto, actor.userId),
    );
    return this.getVisibleOrFail(id, actor);
  }

  /** Team: every request; a viewer: only their own (filtered in SQL). */
  findAll(
    query: QueryAgencyRequestDto,
    actor: NetworkActor,
  ): Promise<AgencyRequest[]> {
    return this.requestRepository.findMany({
      createdById: ownerScope(actor),
      status: query.status,
      limit: AGENCY_REQUEST_LIST_LIMIT,
    });
  }

  /** A foreign request reads as missing (404) for a viewer. */
  findById(id: string, actor: NetworkActor): Promise<AgencyRequest> {
    return this.getVisibleOrFail(id, actor);
  }

  /**
   * Team only. RolesGuard rejects viewers at the controller; the check here
   * keeps the rule if the service is reused elsewhere.
   */
  async update(
    id: string,
    dto: UpdateAgencyRequestDto,
    actor: NetworkActor,
  ): Promise<AgencyRequest> {
    if (!isTeamRole(actor.roleId)) {
      throw new ForbiddenException();
    }

    const patch = toAgencyRequestPatch(dto);
    if (patch.vesselId) {
      await this.assertVesselExists(patch.vesselId);
    }
    if (
      Object.keys(patch).length > 0 &&
      !(await this.requestRepository.update(id, patch))
    ) {
      throw this.requestNotFound();
    }
    return this.getVisibleOrFail(id, actor);
  }

  private async getVisibleOrFail(
    id: string,
    actor: NetworkActor,
  ): Promise<AgencyRequest> {
    const request = await this.requestRepository.findOne(id, ownerScope(actor));
    if (!request) {
      throw this.requestNotFound();
    }
    return request;
  }

  /** Soft-deleted vessels count as missing (VesselRepository.findById). */
  private async assertVesselExists(vesselId: string): Promise<void> {
    if (!(await this.vesselRepository.findById(vesselId))) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { vesselId: 'notFound' },
      });
    }
  }

  private requestNotFound(): NotFoundException {
    return new NotFoundException('Agency request not found');
  }
}

/** null = no author restriction (team); otherwise the caller's own requests. */
function ownerScope(actor: NetworkActor): number | null {
  return isTeamRole(actor.roleId) ? null : actor.userId;
}

/**
 * The DTO transforms already produced the stored values (trimmed strings,
 * blank optionals → null, upper-cased vesselName); omitted optionals → null.
 */
function toNewAgencyRequest(
  dto: CreateAgencyRequestDto,
  createdById: number,
): NewAgencyRequest {
  return {
    createdById,
    company: dto.company,
    contactName: dto.contactName,
    email: dto.email,
    phone: dto.phone ?? null,
    vesselName: dto.vesselName,
    imo: dto.imo ?? null,
    vesselType: dto.vesselType,
    destination: dto.destination,
    eta: dto.eta ? new Date(dto.eta) : null,
    cargo: dto.cargo ?? null,
    notes: dto.notes ?? null,
  };
}

/** Only keys present in the body; null clears staffNote / vesselId. */
function toAgencyRequestPatch(dto: UpdateAgencyRequestDto): AgencyRequestPatch {
  const patch: AgencyRequestPatch = {};
  if (dto.status !== undefined) {
    patch.status = dto.status;
  }
  if (dto.staffNote !== undefined) {
    patch.staffNote = dto.staffNote;
  }
  if (dto.vesselId !== undefined) {
    patch.vesselId = dto.vesselId;
  }
  return patch;
}
