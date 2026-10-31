import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyRequestRepository } from '../agency-request.repository';
import { AgencyRequestEntity } from './entities/agency-request.entity';
import { AgencyRequestRelationalRepository } from './repositories/agency-request.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AgencyRequestEntity])],
  providers: [
    {
      provide: AgencyRequestRepository,
      useClass: AgencyRequestRelationalRepository,
    },
  ],
  exports: [AgencyRequestRepository],
})
export class RelationalAgencyRequestPersistenceModule {}
