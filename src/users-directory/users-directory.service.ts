import { Injectable } from '@nestjs/common';
import { UserCard } from './domain/user-card';
import { UserDirectoryRepository } from './infrastructure/persistence/user-directory.repository';
import { canSeeUser, NetworkActor, visibleRoleIds } from './user-visibility';

export const USER_DIRECTORY_LIMIT = 200;

export interface UserVisibility {
  /** Active users the actor may see. */
  visible: number[];
  /** Active users hidden from the actor by role (viewer → viewer). */
  hidden: number[];
  /** Unknown or soft-deleted users. */
  missing: number[];
}

@Injectable()
export class UsersDirectoryService {
  constructor(private readonly directoryRepository: UserDirectoryRepository) {}

  search(actor: NetworkActor, search?: string): Promise<UserCard[]> {
    return this.directoryRepository.search({
      excludeUserId: actor.userId,
      roleIds: visibleRoleIds(actor),
      search,
      limit: USER_DIRECTORY_LIMIT,
    });
  }

  /** Splits user ids by what the actor may do with them (the actor is not special-cased). */
  async classify(actor: NetworkActor, ids: number[]): Promise<UserVisibility> {
    const found = new Map(
      (await this.directoryRepository.findActiveRoles(ids)).map((user) => [
        user.id,
        user.roleId,
      ]),
    );
    const result: UserVisibility = { visible: [], hidden: [], missing: [] };
    for (const id of ids) {
      if (!found.has(id)) {
        result.missing.push(id);
      } else if (canSeeUser(actor, found.get(id) ?? null)) {
        result.visible.push(id);
      } else {
        result.hidden.push(id);
      }
    }
    return result;
  }

  async isVisible(actor: NetworkActor, userId: number): Promise<boolean> {
    const { visible } = await this.classify(actor, [userId]);
    return visible.length === 1;
  }
}
