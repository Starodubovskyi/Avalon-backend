import { Module } from '@nestjs/common';
import { UserRankModule } from '../user-rank/user-rank.module';
import { UsersDirectoryModule } from '../users-directory/users-directory.module';
import { RelationalProfilePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

/** Personal pages and profile fields (headline, bio, phone, locale). */
@Module({
  imports: [
    RelationalProfilePersistenceModule,
    UsersDirectoryModule,
    UserRankModule,
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
