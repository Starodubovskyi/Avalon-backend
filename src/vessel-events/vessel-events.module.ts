import { Module } from '@nestjs/common';
import { RelationalVesselPersistenceModule } from '../vessels/infrastructure/persistence/relational/relational-persistence.module';
import { RelationalVesselEventPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { VesselEventsController } from './vessel-events.controller';
import { VesselEventsService } from './vessel-events.service';

@Module({
  imports: [
    RelationalVesselEventPersistenceModule,
    RelationalVesselPersistenceModule,
  ],
  controllers: [VesselEventsController],
  providers: [VesselEventsService],
  exports: [VesselEventsService],
})
export class VesselEventsModule {}
