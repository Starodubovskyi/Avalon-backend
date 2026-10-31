import { NullableType } from '../../../utils/types/nullable.type';
import { PostData, PostRef } from '../../domain/post';
import { FeedScope } from '../../social.constants';

export interface FeedFilter {
  /** Drives likedByMe and the `following` scope. */
  viewerId: number;
  /** following = authors the viewer follows + the viewer. */
  scope: FeedScope;
  /** Only posts by authors with these roles (plus the viewer's own); null = everyone. */
  authorRoleIds: number[] | null;
  /** ISO date-time: only posts created strictly before it. */
  before?: string;
  limit: number;
}

/** Soft-deleted posts are never returned. Counters are computed in SQL. */
export abstract class PostRepository {
  /** Newest first. */
  abstract findFeed(filter: FeedFilter): Promise<PostData[]>;

  abstract findOne(
    id: string,
    viewerId: number,
  ): Promise<NullableType<PostData>>;

  abstract findActiveRef(id: string): Promise<NullableType<PostRef>>;

  /** Returns the new post id. */
  abstract create(authorId: number, body: string): Promise<string>;

  /** false when the post is already deleted. */
  abstract softDelete(id: string): Promise<boolean>;

  /** Idempotent (no-op when already liked). */
  abstract like(postId: string, userId: number): Promise<void>;

  /** Idempotent (no-op when not liked). */
  abstract unlike(postId: string, userId: number): Promise<void>;

  abstract countLikes(postId: string): Promise<number>;
}
