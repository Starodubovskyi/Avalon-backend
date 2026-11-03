/**
 * Points per contribution in the user Rank. Soft-deleted content (and posts'
 * comments under deleted posts) does not count. Active RANK boosts
 * (rank_boost, see RANK_BOOST in the wallet) add their points on top.
 */
export const RANK_WEIGHTS = {
  mapPoint: 10,
  mapPointWithLogo: 5,
  post: 3,
  comment: 1,
  agencyRequest: 5,
} as const;
