import { Module } from '@nestjs/common';
import { VesselEventsModule } from '../vessel-events/vessel-events.module';
import { RelationalVesselPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { VesselsController } from './vessels.controller';
import { VesselsService } from './vessels.service';

@Module({
  imports: [RelationalVesselPersistenceModule, VesselEventsModule],
  controllers: [VesselsController],
  providers: [VesselsService],
  exports: [VesselsService, RelationalVesselPersistenceModule],
})
export class VesselsModule {}
