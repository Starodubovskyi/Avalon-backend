import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapPointEntity } from './entities/map-point.entity';
import { MapPointRepository } from '../map-point.repository';
import { MapPointRelationalRepository } from './repositories/map-point.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MapPointEntity])],
  providers: [
    {
      provide: MapPointRepository,
      useClass: MapPointRelationalRepository,
    },
  ],
  exports: [MapPointRepository],
})
export class RelationalMapPointPersistenceModule {}
