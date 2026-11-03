import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toUserCard } from '../../../../../users-directory/domain/user-card';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import { CompanyMemberRecord } from '../../../../domain/company';
import { CompanyMemberStatus } from '../../../../companies.constants';
import {
  CompanyMemberPatch,
  CompanyMemberRepository,
  PersonCardRecord,
} from '../../company-member.repository';
import { CompanyMemberEntity } from '../entities/company-member.entity';

interface MemberRow {
  id: number | string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
  headline: string | null;
  position: string | null;
  status: CompanyMemberStatus;
  createdAt: Date;
}

const SELECT_MEMBERS = `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId",
         u."headline", m."position", m."status", m."createdAt"
  FROM "company_member" m
  JOIN "user" u ON u."id" = m."userId" AND u."deletedAt" IS NULL`;

function toRecord(row: MemberRow): CompanyMemberRecord {
  return {
    user: toUserCard({
      id: Number(row.id),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      roleId: row.roleId,
    }),
    headline: row.headline,
    position: row.position,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class CompanyMemberRelationalRepository
  implements CompanyMemberRepository
{
  constructor(
    @InjectRepository(CompanyMemberEntity)
    private readonly memberRepository: Repository<CompanyMemberEntity>,
  ) {}

  async findMembers(
    pointId: string,
    includePending: boolean,
    limit: number,
  ): Promise<CompanyMemberRecord[]> {
    const params = new SqlParams();
    const where = [`m."pointId" = ${params.add(pointId)}`];
    if (!includePending) {
      where.push(`m."status" = 'active'`);
    }
    const rows: MemberRow[] = await this.memberRepository.query(
      `${SELECT_MEMBERS}
       WHERE ${where.join(' AND ')}
       ORDER BY (m."status" = 'active') DESC, m."createdAt" ASC, u."id" ASC
       LIMIT ${params.add(limit)}`,
      params.values,
    );
    return rows.map(toRecord);
  }

  async findMember(
    pointId: string,
    userId: number,
  ): Promise<NullableType<CompanyMemberRecord>> {
    const [row]: MemberRow[] = await this.memberRepository.query(
      `${SELECT_MEMBERS} WHERE m."pointId" = $1 AND m."userId" = $2`,
      [pointId, userId],
    );
    return row ? toRecord(row) : null;
  }

  async create(
    pointId: string,
    userId: number,
    position: string | null,
  ): Promise<void> {
    await this.memberRepository.insert({ pointId, userId, position });
  }

  async update(
    pointId: string,
    userId: number,
    patch: CompanyMemberPatch,
  ): Promise<boolean> {
    const changes: Partial<Pick<CompanyMemberEntity, 'status' | 'position'>> =
      {};
    if (patch.status !== undefined) {
      changes.status = patch.status;
    }
    if (patch.position !== undefined) {
      changes.position = patch.position;
    }
    if (Object.keys(changes).length === 0) {
      return this.memberRepository.exists({ where: { pointId, userId } });
    }
    const result = await this.memberRepository.update(
      { pointId, userId },
      changes,
    );
    return (result.affected ?? 0) > 0;
  }

  async remove(pointId: string, userId: number): Promise<boolean> {
    const result = await this.memberRepository.delete({ pointId, userId });
    return (result.affected ?? 0) > 0;
  }

  async findActivePointIds(userId: number): Promise<string[]> {
    const rows = await this.memberRepository.find({
      select: { pointId: true },
      where: { userId, status: 'active' },
    });
    return rows.map((row) => row.pointId);
  }

  async findPersonCard(
    userId: number,
  ): Promise<NullableType<PersonCardRecord>> {
    const [row]: Omit<MemberRow, 'position' | 'status' | 'createdAt'>[] =
      await this.memberRepository.query(
        `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId", u."headline"
         FROM "user" u WHERE u."id" = $1 AND u."deletedAt" IS NULL`,
        [userId],
      );
    return row
      ? {
          user: toUserCard({
            id: Number(row.id),
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            roleId: row.roleId,
          }),
          headline: row.headline,
        }
      : null;
  }
}
