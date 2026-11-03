import { escapeLikePattern } from '../../../../utils/escape-like';

/** `%term%` with LIKE wildcards escaped; null when the search is blank. */
export function toUserSearchPattern(search: string | undefined): string | null {
  const term = search?.trim();
  return term ? `%${escapeLikePattern(term)}%` : null;
}

/**
 * Whose emails a non-team caller may match on (same rule as canSeeEmail):
 * the team roles and the caller. Values are SQL parameter placeholders.
 */
export interface EmailSearchScope {
  /** `$n` of an int[]: roles whose emails are visible (admin, staff). */
  roleIdsParam: string;
  /** `$n` of the caller's id. */
  selfParam: string;
}

/**
 * SQL condition matching first name, last name, "first last" or email
 * against an ILIKE pattern parameter (`:pattern` or `$n`). With
 * `emailScope`, the email only matches for users whose email the caller may
 * see, so a search cannot probe hidden addresses.
 */
export function userSearchCondition(
  alias: string,
  param: string,
  emailScope: EmailSearchScope | null = null,
): string {
  const user = `"${alias}"`;
  const email = emailScope
    ? `(${user}."email" ILIKE ${param} AND (${user}."roleId" = ANY(${emailScope.roleIdsParam}::int[]) OR ${user}."id" = ${emailScope.selfParam}))`
    : `${user}."email" ILIKE ${param}`;
  return `(${user}."firstName" ILIKE ${param} OR ${user}."lastName" ILIKE ${param} OR ${email} OR concat_ws(' ', ${user}."firstName", ${user}."lastName") ILIKE ${param})`;
}

/**
 * Stable alphabetical order for people lists. `byEmail: false` leaves the
 * email out of the tie-break (callers who may not see every email).
 */
export function userOrderBy(alias: string, byEmail = true): string {
  const user = `"${alias}"`;
  const email = byEmail ? ` ${user}."email" ASC NULLS LAST,` : '';
  return `${user}."firstName" ASC NULLS LAST, ${user}."lastName" ASC NULLS LAST,${email} ${user}."id" ASC`;
}
