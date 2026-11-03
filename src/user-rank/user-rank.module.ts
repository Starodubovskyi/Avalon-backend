import { Module } from '@nestjs/common';
import { RelationalUserRankPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UserRankService } from './user-rank.service';

@Module({
  imports: [RelationalUserRankPersistenceModule],
  providers: [UserRankService],
  exports: [UserRankService],
})
export class UserRankModule {}
