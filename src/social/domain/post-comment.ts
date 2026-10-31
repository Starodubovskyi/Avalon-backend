import { ApiProperty } from '@nestjs/swagger';
import { UserCard } from '../../users-directory/domain/user-card';

export class PostComment {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, format: 'uuid' })
  postId: string;

  @ApiProperty({ type: () => UserCard })
  author: UserCard;

  @ApiProperty({ type: String })
  body: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: Boolean, description: 'Caller is the author or admin' })
  canDelete: boolean;
}

export type PostCommentData = Omit<PostComment, 'canDelete'>;

/** Non-deleted comment of a non-deleted post. */
export interface PostCommentRef {
  id: string;
  postId: string;
  authorId: number;
}
