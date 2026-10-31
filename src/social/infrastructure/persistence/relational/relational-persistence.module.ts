import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeopleRepository } from '../people.repository';
import { PostCommentRepository } from '../post-comment.repository';
import { PostRepository } from '../post.repository';
import { FollowEntity } from './entities/follow.entity';
import { PostCommentEntity } from './entities/post-comment.entity';
import { PostLikeEntity } from './entities/post-like.entity';
import { PostEntity } from './entities/post.entity';
import { PeopleRelationalRepository } from './repositories/people.repository';
import { PostCommentRelationalRepository } from './repositories/post-comment.repository';
import { PostRelationalRepository } from './repositories/post.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostEntity,
      PostLikeEntity,
      PostCommentEntity,
      FollowEntity,
    ]),
  ],
  providers: [
    {
      provide: PostRepository,
      useClass: PostRelationalRepository,
    },
    {
      provide: PostCommentRepository,
      useClass: PostCommentRelationalRepository,
    },
    {
      provide: PeopleRepository,
      useClass: PeopleRelationalRepository,
    },
  ],
  exports: [PostRepository, PostCommentRepository, PeopleRepository],
})
export class RelationalSocialPersistenceModule {}
