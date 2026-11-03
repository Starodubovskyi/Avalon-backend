import { Module } from '@nestjs/common';
import { MapPointsService } from './map-points.service';
import { MapPointsController } from './map-points.controller';
import { RelationalMapPointPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { FilesModule } from '../files/files.module';
import { UserRankModule } from '../user-rank/user-rank.module';

@Module({
  imports: [RelationalMapPointPersistenceModule, FilesModule, UserRankModule],
  controllers: [MapPointsController],
  providers: [MapPointsService],
  exports: [MapPointsService, RelationalMapPointPersistenceModule],
})
export class MapPointsModule {}
