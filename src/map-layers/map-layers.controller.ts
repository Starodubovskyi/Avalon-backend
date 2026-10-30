import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MapLayersService } from './map-layers.service';
import { MapLayersQueryDto } from './dto/map-layers-query.dto';

@ApiTags('Map layers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'map',
  version: '1',
})
export class MapLayersController {
  constructor(private readonly mapLayersService: MapLayersService) {}

  @Get('layers')
  @ApiOkResponse({
    description: 'GeoJSON FeatureCollections keyed by catalog kind',
  })
  @HttpCode(HttpStatus.OK)
  getLayers(@Query() query: MapLayersQueryDto) {
    return this.mapLayersService.getLayers(query.kinds);
  }
}
