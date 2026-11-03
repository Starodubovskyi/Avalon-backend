import { UserRankInputs } from '../../domain/user-rank';

/** Read-only counters behind the user Rank, computed on read. */
export abstract class UserRankRepository {
  /** One row per requested id (zeros for users without content). */
  abstract findInputs(userIds: number[]): Promise<UserRankInputs[]>;
}
