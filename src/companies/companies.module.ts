import { Module } from '@nestjs/common';
import { MapPointsModule } from '../map-points/map-points.module';
import { UserRankModule } from '../user-rank/user-rank.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { RelationalCompanyMemberPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

/** Company profiles of map points and their members. */
@Module({
  imports: [
    RelationalCompanyMemberPersistenceModule,
    MapPointsModule,
    UserRankModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
