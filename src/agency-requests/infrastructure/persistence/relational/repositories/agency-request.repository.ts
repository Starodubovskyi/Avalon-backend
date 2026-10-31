import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import {
  AgencyRequest,
  AgencyRequestPatch,
  NewAgencyRequest,
} from '../../../../domain/agency-request';
import {
  AgencyRequestListFilter,
  AgencyRequestRepository,
} from '../../agency-request.repository';
import { AgencyRequestEntity } from '../entities/agency-request.entity';
import {
  AgencyRequestMapper,
  AgencyRequestRow,
} from '../mappers/agency-request.mapper';

// LEFT JOIN without a deletedAt filter keeps the author of a soft-deleted user.
const SELECT_REQUESTS = `SELECT r."id", r."status", r."company", r."contactName", r."email",
         r."phone", r."vesselName", r."imo", r."vesselType", r."destination",
         r."eta", r."cargo", r."notes", r."staffNote", r."vesselId",
         r."createdAt", r."updatedAt",
         u."id" AS "authorId", u."firstName" AS "authorFirstName",
         u."lastName" AS "authorLastName", u."email" AS "authorEmail"
  FROM "agency_request" r
  LEFT JOIN "user" u ON u."id" = r."createdById"`;

@Injectable()
export class AgencyRequestRelationalRepository
  implements AgencyRequestRepository
{
  constructor(
    @InjectRepository(AgencyRequestEntity)
    private readonly requestRepository: Repository<AgencyRequestEntity>,
  ) {}

  async findMany(filter: AgencyRequestListFilter): Promise<AgencyRequest[]> {
    const params = new SqlParams();
    const where: string[] = [];
    // Served by IDX_agency_request_createdById_createdAt / _status_createdAt.
    if (filter.createdById !== null) {
      where.push(`r."createdById" = ${params.add(filter.createdById)}`);
    }
    if (filter.status) {
      where.push(`r."status" = ${params.add(filter.status)}`);
    }

    const rows: AgencyRequestRow[] = await this.requestRepository.query(
      `${SELECT_REQUESTS}
       ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r."createdAt" DESC, r."id" DESC
       LIMIT ${params.add(filter.limit)}`,
      params.values,
    );
    return rows.map((row) => AgencyRequestMapper.toDomain(row));
  }

  async findOne(
    id: string,
    createdById: number | null,
  ): Promise<NullableType<AgencyRequest>> {
    const params = new SqlParams();
    const where = [`r."id" = ${params.add(id)}`];
    if (createdById !== null) {
      where.push(`r."createdById" = ${params.add(createdById)}`);
    }

    const [row]: AgencyRequestRow[] = await this.requestRepository.query(
      `${SELECT_REQUESTS} WHERE ${where.join(' AND ')}`,
      params.values,
    );
    return row ? AgencyRequestMapper.toDomain(row) : null;
  }

  async create(data: NewAgencyRequest): Promise<string> {
    // Explicit copy keeps unknown keys out of the INSERT.
    const result = await this.requestRepository.insert({
      createdById: data.createdById,
      company: data.company,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      vesselName: data.vesselName,
      imo: data.imo,
      vesselType: data.vesselType,
      destination: data.destination,
      eta: data.eta,
      cargo: data.cargo,
      notes: data.notes,
    });
    return (result.identifiers[0] as { id: string }).id;
  }

  async update(id: string, patch: AgencyRequestPatch): Promise<boolean> {
    const values: AgencyRequestPatch = {};
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.staffNote !== undefined) values.staffNote = patch.staffNote;
    if (patch.vesselId !== undefined) values.vesselId = patch.vesselId;

    // updatedAt is bumped by TypeORM (UpdateDateColumn).
    const result = await this.requestRepository.update({ id }, values);
    return (result.affected ?? 0) > 0;
  }
}
