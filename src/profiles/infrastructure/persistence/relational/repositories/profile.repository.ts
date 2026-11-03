import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MapPointKind } from '../../../../../map-points/map-point.constants';
import { toUserCard } from '../../../../../users-directory/domain/user-card';
import { pointVisibleToSql } from '../../../../../users-directory/infrastructure/persistence/relational/user-visibility-sql';
import { Locale } from '../../../../../users/user-profile.constants';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import { CompanyMemberRole } from '../../../../../companies/companies.constants';
import { PersonCompany } from '../../../../domain/person-profile';
import {
  MEMBER_COMPANY_KINDS,
  OWNED_COMPANY_KINDS,
} from '../../../../profiles.constants';
import {
  ProfilePatch,
  ProfileRecord,
  ProfileRepository,
} from '../../profile.repository';

interface ProfileRow {
  id: number | string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
  headline: string | null;
  bio: string | null;
  phone: string | null;
  locale: Locale;
  createdAt: Date;
  points: number | string;
  posts: number | string;
  followers: number | string;
  following: number | string;
  isFollowing: boolean;
}

interface CompanyRow {
  pointId: string;
  title: string;
  kind: MapPointKind;
  role: CompanyMemberRole;
  position: string | null;
  hasLogo: boolean;
  updatedAt: Date;
}

/** Points visible to `visibleTo` (public + own), or TRUE for the team. */
function pointVisibleSql(
  alias: string,
  visibleTo: number | null,
  params: SqlParams,
): string {
  return visibleTo === null
    ? 'TRUE'
    : pointVisibleToSql(alias, params.add(visibleTo));
}

@Injectable()
export class ProfileRelationalRepository implements ProfileRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findProfile(
    userId: number,
    viewerId: number,
    pointsVisibleTo: number | null,
  ): Promise<NullableType<ProfileRecord>> {
    const params = new SqlParams();
    const user = params.add(userId);
    const viewer = params.add(viewerId);
    // Follow counters ignore soft-deleted accounts on the other side.
    const [row]: ProfileRow[] = await this.dataSource.query(
      `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId",
         u."headline", u."bio", u."phone", u."locale", u."createdAt",
         (SELECT COUNT(*)::int FROM "map_point" mp
          WHERE mp."userId" = u."id" AND mp."deletedAt" IS NULL
            AND ${pointVisibleSql('mp', pointsVisibleTo, params)}) AS "points",
         (SELECT COUNT(*)::int FROM "post" p
          WHERE p."authorId" = u."id" AND p."deletedAt" IS NULL) AS "posts",
         (SELECT COUNT(*)::int FROM "follow" f
          JOIN "user" fu ON fu."id" = f."followerId" AND fu."deletedAt" IS NULL
          WHERE f."followeeId" = u."id") AS "followers",
         (SELECT COUNT(*)::int FROM "follow" f
          JOIN "user" fu ON fu."id" = f."followeeId" AND fu."deletedAt" IS NULL
          WHERE f."followerId" = u."id") AS "following",
         EXISTS (SELECT 1 FROM "follow" f
                 WHERE f."followerId" = ${viewer} AND f."followeeId" = u."id") AS "isFollowing"
       FROM "user" u
       WHERE u."id" = ${user} AND u."deletedAt" IS NULL`,
      params.values,
    );
    if (!row) {
      return null;
    }
    return {
      user: toUserCard({
        id: Number(row.id),
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        roleId: row.roleId,
      }),
      headline: row.headline,
      bio: row.bio,
      phone: row.phone,
      locale: row.locale,
      createdAt: row.createdAt.toISOString(),
      stats: {
        points: Number(row.points),
        posts: Number(row.posts),
        followers: Number(row.followers),
        following: Number(row.following),
      },
      isFollowing: Boolean(row.isFollowing),
    };
  }

  async findCompanies(
    userId: number,
    pointsVisibleTo: number | null,
    limit: number,
  ): Promise<PersonCompany[]> {
    const params = new SqlParams();
    const user = params.add(userId);
    const rows: CompanyRow[] = await this.dataSource.query(
      `SELECT * FROM (
         SELECT p."id" AS "pointId", p."firstName" AS "title", p."kind",
                'owner' AS "role", NULL::varchar AS "position",
                (p."logo" IS NOT NULL) AS "hasLogo", p."updatedAt", p."createdAt" AS "since"
         FROM "map_point" p
         WHERE p."userId" = ${user} AND p."deletedAt" IS NULL
           AND p."kind" = ANY(${params.add(OWNED_COMPANY_KINDS)}::text[])
           AND ${pointVisibleSql('p', pointsVisibleTo, params)}
         UNION ALL
         SELECT p."id", p."firstName", p."kind", 'member', m."position",
                (p."logo" IS NOT NULL), p."updatedAt", m."createdAt"
         FROM "company_member" m
         JOIN "map_point" p ON p."id" = m."pointId" AND p."deletedAt" IS NULL
         WHERE m."userId" = ${user} AND m."status" = 'active'
           AND p."kind" = ANY(${params.add(MEMBER_COMPANY_KINDS)}::text[])
           AND ${pointVisibleSql('p', pointsVisibleTo, params)}
       ) c
       ORDER BY c."role" = 'owner' DESC, c."since" DESC, c."pointId" DESC
       LIMIT ${params.add(limit)}`,
      params.values,
    );
    return rows.map((row) => {
      const company = new PersonCompany();
      company.pointId = row.pointId;
      company.title = row.title;
      company.kind = row.kind;
      company.role = row.role;
      company.position = row.position;
      company.hasLogo = Boolean(row.hasLogo);
      // Same cache key as MapPointView.logoVersion.
      company.logoVersion = company.hasLogo
        ? String(row.updatedAt.getTime())
        : null;
      return company;
    });
  }

  async update(userId: number, patch: ProfilePatch): Promise<void> {
    const params = new SqlParams();
    const sets: string[] = [];
    for (const field of ['headline', 'bio', 'phone', 'locale'] as const) {
      if (patch[field] !== undefined) {
        sets.push(`"${field}" = ${params.add(patch[field])}`);
      }
    }
    if (sets.length === 0) {
      return;
    }
    await this.dataSource.query(
      `UPDATE "user" SET ${sets.join(', ')}, "updatedAt" = now()
       WHERE "id" = ${params.add(userId)} AND "deletedAt" IS NULL`,
      params.values,
    );
  }
}
