import { QueryFailedError } from 'typeorm';

/** Postgres unique_violation (23505) on the given constraint/unique index. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return driverError.code === '23505' && driverError.constraint === constraint;
}
