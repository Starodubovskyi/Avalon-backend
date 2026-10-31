import { escapeLikePattern } from '../../../../utils/escape-like';

/** `%term%` with LIKE wildcards escaped; null when the search is blank. */
export function toUserSearchPattern(search: string | undefined): string | null {
  const term = search?.trim();
  return term ? `%${escapeLikePattern(term)}%` : null;
}

/**
 * SQL condition matching first name, last name, "first last" or email
 * against an ILIKE pattern parameter (`:pattern` or `$n`).
 */
export function userSearchCondition(alias: string, param: string): string {
  const user = `"${alias}"`;
  return `(${user}."firstName" ILIKE ${param} OR ${user}."lastName" ILIKE ${param} OR ${user}."email" ILIKE ${param} OR concat_ws(' ', ${user}."firstName", ${user}."lastName") ILIKE ${param})`;
}

/** Stable alphabetical order for people lists. */
export function userOrderBy(alias: string): string {
  const user = `"${alias}"`;
  return `${user}."firstName" ASC NULLS LAST, ${user}."lastName" ASC NULLS LAST, ${user}."email" ASC NULLS LAST, ${user}."id" ASC`;
}
