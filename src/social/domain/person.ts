import { ApiProperty } from '@nestjs/swagger';
import { UserCard } from '../../users-directory/domain/user-card';

export class Person extends UserCard {
  @ApiProperty({ type: Boolean })
  followedByMe: boolean;

  @ApiProperty({ type: Boolean })
  followsMe: boolean;

  @ApiProperty({ type: Number })
  followers: number;

  @ApiProperty({ type: Number })
  following: number;

  @ApiProperty({ type: Number, description: 'Non-deleted posts' })
  posts: number;
}
