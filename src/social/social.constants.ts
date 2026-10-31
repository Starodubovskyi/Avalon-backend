export const FEED_SCOPES = ['all', 'following'] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];

export const PEOPLE_FILTERS = [
  'all',
  'friends',
  'following',
  'followers',
] as const;
export type PeopleFilter = (typeof PEOPLE_FILTERS)[number];

export const POST_BODY_MAX_LENGTH = 5000;
export const COMMENT_BODY_MAX_LENGTH = 2000;

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;
export const COMMENTS_LIMIT = 200;
export const PEOPLE_LIMIT = 200;
