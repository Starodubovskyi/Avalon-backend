import { ApiProperty } from '@nestjs/swagger';
import { UserCard } from '../../users-directory/domain/user-card';

export class Post {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: () => UserCard })
  author: UserCard;

  @ApiProperty({ type: String })
  body: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: Number })
  likeCount: number;

  @ApiProperty({ type: Number, description: 'Non-deleted comments' })
  commentCount: number;

  @ApiProperty({ type: Boolean })
  likedByMe: boolean;

  @ApiProperty({ type: Boolean, description: 'Caller is the author or admin' })
  canDelete: boolean;
}

/** A post as read from storage; canDelete depends on the caller (service). */
export type PostData = Omit<Post, 'canDelete'>;

/** Non-deleted post reference used for permission checks. */
export interface PostRef {
  id: string;
  authorId: number;
}

export class PostLikeState {
  @ApiProperty({ type: Number, example: 3 })
  likeCount: number;

  @ApiProperty({ type: Boolean })
  likedByMe: boolean;
}
