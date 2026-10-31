import { Module } from '@nestjs/common';
import { RelationalVesselPersistenceModule } from '../vessels/infrastructure/persistence/relational/relational-persistence.module';
import { AgencyRequestsController } from './agency-requests.controller';
import { AgencyRequestsService } from './agency-requests.service';
import { RelationalAgencyRequestPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

/** Agency requests from clients (viewers), handled by admin/staff. */
@Module({
  imports: [
    RelationalAgencyRequestPersistenceModule,
    RelationalVesselPersistenceModule,
  ],
  controllers: [AgencyRequestsController],
  providers: [AgencyRequestsService],
})
export class AgencyRequestsModule {}
