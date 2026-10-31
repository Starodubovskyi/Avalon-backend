import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { UserDirectoryRepository } from '../user-directory.repository';
import { UserDirectoryRelationalRepository } from './repositories/user-directory.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    {
      provide: UserDirectoryRepository,
      useClass: UserDirectoryRelationalRepository,
    },
  ],
  exports: [UserDirectoryRepository],
})
export class RelationalUserDirectoryPersistenceModule {}
