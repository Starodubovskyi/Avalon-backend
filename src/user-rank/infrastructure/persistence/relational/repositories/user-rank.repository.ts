import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SqlParams } from '../../../../../utils/sql-params';
import { UserRankInputs } from '../../../../domain/user-rank';
import { UserRankRepository } from '../../user-rank.repository';

interface UserRankRow {
  userId: number | string;
  mapPoints: number | string;
  mapPointsWithLogo: number | string;
  posts: number | string;
  comments: number | string;
  agencyRequests: number | string;
  boostPoints: number | string;
}

@Injectable()
export class UserRankRelationalRepository implements UserRankRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findInputs(userIds: number[]): Promise<UserRankInputs[]> {
    if (userIds.length === 0) {
      return [];
    }
    const params = new SqlParams();
    // Agency requests have no soft delete; comments under a deleted post
    // are hidden with it, so they do not count either.
    const rows: UserRankRow[] = await this.dataSource.query(
      `SELECT t."userId",
         m."mapPoints",
         m."mapPointsWithLogo",
         (SELECT COUNT(*)::int FROM "post" p
          WHERE p."authorId" = t."userId" AND p."deletedAt" IS NULL) AS "posts",
         (SELECT COUNT(*)::int FROM "post_comment" c
          JOIN "post" cp ON cp."id" = c."postId" AND cp."deletedAt" IS NULL
          WHERE c."authorId" = t."userId" AND c."deletedAt" IS NULL) AS "comments",
         (SELECT COUNT(*)::int FROM "agency_request" r
          WHERE r."createdById" = t."userId") AS "agencyRequests",
         (SELECT COALESCE(SUM(b."points"), 0)::int FROM "rank_boost" b
          WHERE b."userId" = t."userId" AND b."expiresAt" > now()) AS "boostPoints"
       FROM unnest(${params.add(userIds)}::int[]) AS t("userId")
       CROSS JOIN LATERAL (
         SELECT COUNT(*)::int AS "mapPoints",
                COUNT(mp."logo")::int AS "mapPointsWithLogo"
         FROM "map_point" mp
         WHERE mp."userId" = t."userId" AND mp."deletedAt" IS NULL
       ) m`,
      params.values,
    );
    return rows.map((row) => ({
      userId: Number(row.userId),
      mapPoints: Number(row.mapPoints),
      mapPointsWithLogo: Number(row.mapPointsWithLogo),
      posts: Number(row.posts),
      comments: Number(row.comments),
      agencyRequests: Number(row.agencyRequests),
      boostPoints: Number(row.boostPoints),
    }));
  }
}
