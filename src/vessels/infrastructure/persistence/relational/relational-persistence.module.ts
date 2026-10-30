import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VesselEntity } from './entities/vessel.entity';
import { VesselRepository } from '../vessel.repository';
import { VesselRelationalRepository } from './repositories/vessel.repository';

@Module({
  imports: [TypeOrmModule.forFeature([VesselEntity])],
  providers: [
    {
      provide: VesselRepository,
      useClass: VesselRelationalRepository,
    },
  ],
  exports: [VesselRepository],
})
export class RelationalVesselPersistenceModule {}
