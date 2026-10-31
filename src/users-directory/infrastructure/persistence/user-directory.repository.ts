import { UserCard } from '../../domain/user-card';

export interface UserDirectoryFilter {
  /** The caller: never part of the result. */
  excludeUserId: number;
  /** null = any role. */
  roleIds: number[] | null;
  search?: string;
  limit: number;
}

/** Minimal projection used for access checks (chat partners, follows). */
export interface DirectoryUserRole {
  id: number;
  roleId: number | null;
}

/** Read-only view of the user table; soft-deleted users are never returned. */
export abstract class UserDirectoryRepository {
  abstract search(filter: UserDirectoryFilter): Promise<UserCard[]>;

  abstract findActiveRoles(ids: number[]): Promise<DirectoryUserRole[]>;
}
