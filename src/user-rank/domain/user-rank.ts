import { RANK_WEIGHTS } from '../user-rank.constants';

/** Counters a Rank is calculated from (active content only). */
export interface UserRankInputs {
  userId: number;
  /** Map points created by the user. */
  mapPoints: number;
  /** Of those, points with a logo (counted on top of `mapPoints`). */
  mapPointsWithLogo: number;
  posts: number;
  comments: number;
  agencyRequests: number;
  /** Sum of the points of active (not expired) RANK boosts bought with credits. */
  boostPoints: number;
}

export function calculateRank(inputs: UserRankInputs): number {
  return (
    RANK_WEIGHTS.mapPoint * inputs.mapPoints +
    RANK_WEIGHTS.mapPointWithLogo * inputs.mapPointsWithLogo +
    RANK_WEIGHTS.post * inputs.posts +
    RANK_WEIGHTS.comment * inputs.comments +
    RANK_WEIGHTS.agencyRequest * inputs.agencyRequests +
    inputs.boostPoints
  );
}
