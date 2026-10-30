import { Module } from '@nestjs/common';
import { VesselEventsModule } from '../vessel-events/vessel-events.module';
import { RelationalVesselPersistenceModule } from '../vessels/infrastructure/persistence/relational/relational-persistence.module';
import { AisController } from './ais.controller';
import { AisService } from './ais.service';

@Module({
  imports: [RelationalVesselPersistenceModule, VesselEventsModule],
  controllers: [AisController],
  providers: [AisService],
})
export class AisModule {}
