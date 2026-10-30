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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MapPointsService } from './map-points.service';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { UpdateMapPointDto } from './dto/update-map-point.dto';
import { QueryMapPointDto } from './dto/query-map-point.dto';
import { MapPoint } from './domain/map-point';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';

/** Shared contacts map of the Avalon team: admin and staff only. */
@ApiTags('Map points')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Viewers (role user) have no access' })
@Roles(RoleEnum.admin, RoleEnum.staff)
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
    description: 'All team points, newest first (max 1000)',
  })
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: QueryMapPointDto): Promise<MapPoint[]> {
    return this.mapPointsService.findAll(query);
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
  findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<MapPoint> {
    return this.mapPointsService.findById(id);
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPoint> {
    return this.mapPointsService.update(id, updateMapPointDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.mapPointsService.remove(id);
  }
}
