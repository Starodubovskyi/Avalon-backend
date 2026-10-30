import { Module } from '@nestjs/common';
import { MapLayersController } from './map-layers.controller';
import { MapLayersService } from './map-layers.service';

@Module({
  controllers: [MapLayersController],
  providers: [MapLayersService],
})
export class MapLayersModule {}
