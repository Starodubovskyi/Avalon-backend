import { Module } from '@nestjs/common';
import { MapPointsService } from './map-points.service';
import { MapPointsController } from './map-points.controller';
import { RelationalMapPointPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [RelationalMapPointPersistenceModule, FilesModule],
  controllers: [MapPointsController],
  providers: [MapPointsService],
  exports: [MapPointsService, RelationalMapPointPersistenceModule],
})
export class MapPointsModule {}
