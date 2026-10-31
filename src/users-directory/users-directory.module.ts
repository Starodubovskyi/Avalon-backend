import { Module } from '@nestjs/common';
import { RelationalUserDirectoryPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersDirectoryController } from './users-directory.controller';
import { UsersDirectoryService } from './users-directory.service';

@Module({
  imports: [RelationalUserDirectoryPersistenceModule],
  controllers: [UsersDirectoryController],
  providers: [UsersDirectoryService],
  exports: [UsersDirectoryService],
})
export class UsersDirectoryModule {}
