import { SqlParams } from '../../../../utils/sql-params';
import { VisibleUsers } from '../../../user-visibility';
import { EmailSearchScope } from './user-search';

/**
 * SQL: the map point alias `alias` is visible to the user `userParam` (a
 * placeholder, `$n` or `:name`): public points and the user's own. The team
 * sees every point — callers skip the condition for them.
 */
export function pointVisibleToSql(alias: string, userParam: string): string {
  return `("${alias}"."visibility" = 'public' OR "${alias}"."userId" = ${userParam})`;
}

/**
 * SQL: the user `userId` (a column expression) has a public profile — owns a
 * public, non-deleted map point or is an active member of one.
 */
export function publicProfileSql(userId: string): string {
  return `(EXISTS (SELECT 1 FROM "map_point" ppo
            WHERE ppo."userId" = ${userId} AND ppo."visibility" = 'public'
              AND ppo."deletedAt" IS NULL)
          OR EXISTS (SELECT 1 FROM "company_member" ppm
            JOIN "map_point" ppp ON ppp."id" = ppm."pointId"
              AND ppp."visibility" = 'public' AND ppp."deletedAt" IS NULL
            WHERE ppm."userId" = ${userId} AND ppm."status" = 'active'))`;
}

/**
 * SQL condition limiting the user table alias `alias` to `scope`
 * (see visibleUsers()); null when there is no restriction.
 */
export function visibleUserSql(
  alias: string,
  scope: VisibleUsers | null,
  params: SqlParams,
): string | null {
  if (scope === null) {
    return null;
  }
  const byRole = `"${alias}"."roleId" = ANY(${params.add(scope.roleIds)}::int[])`;
  return scope.publicProfiles
    ? `(${byRole} OR ${publicProfileSql(`"${alias}"."id"`)})`
    : byRole;
}

/**
 * Email matching in people searches for a restricted caller: only the team
 * roles' and the caller's own emails. null for the team (match any email).
 */
export function emailSearchScope(
  scope: VisibleUsers | null,
  callerId: number,
  params: SqlParams,
): EmailSearchScope | null {
  return scope === null
    ? null
    : {
        roleIdsParam: params.add(scope.roleIds),
        selfParam: params.add(callerId),
      };
}
