import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { RelationalSocialPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

/**
 * Feed (posts, likes, comments) and people/follows. Shares the folder with
 * the OAuth social-login types (interfaces/, tokens.ts) but not their code.
 */
@Module({
  imports: [RelationalSocialPersistenceModule],
  controllers: [PostsController, CommentsController, PeopleController],
  providers: [PostsService, PeopleService],
})
export class SocialModule {}
