import { Injectable } from '@nestjs/common';
import { UserCard } from './domain/user-card';
import { UserDirectoryRepository } from './infrastructure/persistence/user-directory.repository';
import {
  canSeeUser,
  NetworkActor,
  redactUserCard,
  visibleUsers,
} from './user-visibility';

export const USER_DIRECTORY_LIMIT = 200;

export interface UserVisibility {
  /** Active users the actor may see. */
  visible: number[];
  /** Active users hidden from the actor (a viewer → a non-public viewer). */
  hidden: number[];
  /** Unknown or soft-deleted users. */
  missing: number[];
}

@Injectable()
export class UsersDirectoryService {
  constructor(private readonly directoryRepository: UserDirectoryRepository) {}

  async search(actor: NetworkActor, search?: string): Promise<UserCard[]> {
    const cards = await this.directoryRepository.search({
      excludeUserId: actor.userId,
      visibleUsers: visibleUsers(actor),
      search,
      limit: USER_DIRECTORY_LIMIT,
    });
    return cards.map((card) => redactUserCard(card, actor));
  }

  /** Splits user ids by what the actor may do with them (the actor is not special-cased). */
  async classify(actor: NetworkActor, ids: number[]): Promise<UserVisibility> {
    const found = new Map(
      (await this.directoryRepository.findActiveRoles(ids)).map((user) => [
        user.id,
        user,
      ]),
    );
    const result: UserVisibility = { visible: [], hidden: [], missing: [] };
    for (const id of ids) {
      const user = found.get(id);
      if (!user) {
        result.missing.push(id);
      } else if (canSeeUser(actor, user)) {
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
