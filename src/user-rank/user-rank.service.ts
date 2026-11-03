import { Injectable } from '@nestjs/common';
import { calculateRank } from './domain/user-rank';
import { UserRankRepository } from './infrastructure/persistence/user-rank.repository';

/**
 * User Rank, calculated on read from the user's active content
 * (see RANK_WEIGHTS) plus active RANK boosts bought with credits.
 * Single entry point, so future contributions are added in one place.
 */
@Injectable()
export class UserRankService {
  constructor(private readonly rankRepository: UserRankRepository) {}

  /** Rank per user id; ids are de-duplicated, invalid ids are skipped. */
  async getRanks(userIds: number[]): Promise<Map<number, number>> {
    const ids = [
      ...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (ids.length === 0) {
      return new Map();
    }
    const inputs = await this.rankRepository.findInputs(ids);
    return new Map(inputs.map((row) => [row.userId, calculateRank(row)]));
  }
}
