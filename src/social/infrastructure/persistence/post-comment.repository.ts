import { NullableType } from '../../../utils/types/nullable.type';
import { VisibleUsers } from '../../../users-directory/user-visibility';
import { PostCommentData, PostCommentRef } from '../../domain/post-comment';

export interface NewPostComment {
  postId: string;
  authorId: number;
  body: string;
}

/** Soft-deleted comments are never returned. */
export abstract class PostCommentRepository {
  /**
   * The latest `limit` comments, ascending by time. With `authors`, only
   * comments by authors the viewer may see plus the viewer's own.
   */
  abstract findByPost(
    postId: string,
    limit: number,
    visibility?: { viewerId: number; authors: VisibleUsers | null },
  ): Promise<PostCommentData[]>;

  abstract create(data: NewPostComment): Promise<PostCommentData>;

  /** null when the comment or its post is deleted. */
  abstract findActiveRef(id: string): Promise<NullableType<PostCommentRef>>;

  /** false when the comment is already deleted. */
  abstract softDelete(id: string): Promise<boolean>;
}
