import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MapPointsService } from './map-points.service';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { UpdateMapPointDto } from './dto/update-map-point.dto';
import { MapPoint } from './domain/map-point';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@ApiTags('Map points')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'map-points',
  version: '1',
})
export class MapPointsController {
  constructor(private readonly mapPointsService: MapPointsService) {}

  @Post()
  @ApiCreatedResponse({
    type: MapPoint,
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: { user: JwtPayloadType },
    @Body() createMapPointDto: CreateMapPointDto,
  ): Promise<MapPoint> {
    return this.mapPointsService.create(request.user.id, createMapPointDto);
  }

  @Get()
  @ApiOkResponse({
    type: [MapPoint],
  })
  @HttpCode(HttpStatus.OK)
  findAll(@Request() request: { user: JwtPayloadType }): Promise<MapPoint[]> {
    return this.mapPointsService.findAllForUser(request.user.id);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: MapPoint,
  })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request: { user: JwtPayloadType },
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPoint> {
    return this.mapPointsService.findByIdForUser(id, request.user.id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: MapPoint,
  })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request: { user: JwtPayloadType },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPoint> {
    return this.mapPointsService.update(id, request.user.id, updateMapPointDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request: { user: JwtPayloadType },
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.mapPointsService.remove(id, request.user.id);
  }
}
