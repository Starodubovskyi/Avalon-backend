import { Module } from '@nestjs/common';
import { PortsService } from './ports.service';
import { PortsController } from './ports.controller';
import { RelationalPortPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalPortPersistenceModule],
  controllers: [PortsController],
  providers: [PortsService],
  exports: [PortsService, RelationalPortPersistenceModule],
})
export class PortsModule {}
