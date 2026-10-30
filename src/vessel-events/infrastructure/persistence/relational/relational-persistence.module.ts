import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VesselEventEntity } from './entities/vessel-event.entity';
import { VesselEventRepository } from '../vessel-event.repository';
import { VesselEventRelationalRepository } from './repositories/vessel-event.repository';

@Module({
  imports: [TypeOrmModule.forFeature([VesselEventEntity])],
  providers: [
    {
      provide: VesselEventRepository,
      useClass: VesselEventRelationalRepository,
    },
  ],
  exports: [VesselEventRepository],
})
export class RelationalVesselEventPersistenceModule {}
