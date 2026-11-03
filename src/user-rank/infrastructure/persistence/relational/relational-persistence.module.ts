import { Module } from '@nestjs/common';
import { UserRankRepository } from '../user-rank.repository';
import { UserRankRelationalRepository } from './repositories/user-rank.repository';

@Module({
  providers: [
    {
      provide: UserRankRepository,
      useClass: UserRankRelationalRepository,
    },
  ],
  exports: [UserRankRepository],
})
export class RelationalUserRankPersistenceModule {}
