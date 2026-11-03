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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { MapPointsService } from './map-points.service';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { UpdateMapPointDto } from './dto/update-map-point.dto';
import { QueryMapPointDto } from './dto/query-map-point.dto';
import { MapPointFavoriteState, MapPointView } from './domain/map-point-view';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { toNetworkActor } from '../users-directory/user-visibility';
import { MapPointActivitySlotsService } from './map-point-activity-slots.service';
import {
  MAP_POINT_LOGO_CACHE_CONTROL,
  MAP_POINT_LOGO_MIME_TYPES,
} from './map-point.constants';

type AuthRequest = { user: JwtPayloadType };

const WRITE_ERRORS_DESCRIPTION =
  '{ errors: { activities: "premiumRequired" | "invalid", logo: "invalid" | "tooLong", visibility: "invalid", description: "tooLong", website: "invalid" | "tooLong", parentId: "invalid" | "notFound", ... } }';

/**
 * Shared map of the team and the clients. admin/staff: every point, edit
 * any. Viewers (role user): public points and their own, at most 5 own
 * points, edit only their own. A point the caller cannot see is 404.
 */
@ApiTags('Map points')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'map-points',
  version: '1',
})
export class MapPointsController {
  constructor(
    private readonly mapPointsService: MapPointsService,
    private readonly activitySlotsService: MapPointActivitySlotsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: MapPointView,
  })
  @ApiUnprocessableEntityResponse({
    description: `${WRITE_ERRORS_DESCRIPTION}; a viewer with 5 points: { errors: { points: "limitReached" } }`,
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: AuthRequest,
    @Body() createMapPointDto: CreateMapPointDto,
  ): Promise<MapPointView> {
    return this.mapPointsService.create(
      toNetworkActor(request.user),
      createMapPointDto,
    );
  }

  @Get()
  @ApiOkResponse({
    type: [MapPointView],
    description:
      'Newest first (max 1000). admin/staff: all points; viewers: public points and their own',
  })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request: AuthRequest,
    @Query() query: QueryMapPointDto,
  ): Promise<MapPointView[]> {
    return this.mapPointsService.findAll(toNetworkActor(request.user), query);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: MapPointView,
  })
  @ApiNotFoundResponse({ description: 'Missing, deleted or not visible' })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointView> {
    return this.mapPointsService.findById(toNetworkActor(request.user), id);
  }

  /**
   * Written with @Res(): the global ResolvePromisesInterceptor would turn a
   * StreamableFile into a plain object. Headers are set only on success, so
   * a 404 is never cached as immutable.
   */
  @Get(':id/logo')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiQuery({
    name: 'v',
    type: String,
    required: false,
    description: 'logoVersion from the point view (cache key, ignored)',
  })
  @ApiProduces(...MAP_POINT_LOGO_MIME_TYPES)
  @ApiOkResponse({
    description: `Logo bytes (webp, png or jpeg). Cache-Control: ${MAP_POINT_LOGO_CACHE_CONTROL}`,
  })
  @ApiNotFoundResponse({
    description: 'No such point (or not visible), or it has no logo',
  })
  async getLogo(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const logo = await this.mapPointsService.getLogo(
      toNetworkActor(request.user),
      id,
    );
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', logo.mimeType);
    response.setHeader('Content-Length', String(logo.bytes.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', MAP_POINT_LOGO_CACHE_CONTROL);
    response.end(logo.bytes);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: MapPointView,
  })
  @ApiForbiddenResponse({ description: 'Not the owner (viewers)' })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: WRITE_ERRORS_DESCRIPTION })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPointView> {
    return this.mapPointsService.update(
      toNetworkActor(request.user),
      id,
      updateMapPointDto,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Not the owner (viewers)' })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.mapPointsService.remove(toNetworkActor(request.user), id);
  }

  @Post(':id/activity-slots')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: MapPointView,
    description:
      'Buys one more Business Activity slot (50 credits from the caller). Owner or admin/staff',
  })
  @ApiForbiddenResponse({ description: 'Not the owner (viewers)' })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { balance: "insufficient" } } | { errors: { activitySlots: "max" } }',
  })
  @HttpCode(HttpStatus.OK)
  buyActivitySlot(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointView> {
    return this.activitySlotsService.purchase(toNetworkActor(request.user), id);
  }

  @Post(':id/favorite')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: MapPointFavoriteState,
    description: 'Adds the point to my favorites. Idempotent.',
  })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.OK)
  addFavorite(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointFavoriteState> {
    return this.mapPointsService.setFavorite(
      toNetworkActor(request.user),
      id,
      true,
    );
  }

  @Delete(':id/favorite')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: MapPointFavoriteState,
    description: 'Removes the point from my favorites. Idempotent.',
  })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.OK)
  removeFavorite(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointFavoriteState> {
    return this.mapPointsService.setFavorite(
      toNetworkActor(request.user),
      id,
      false,
    );
  }
}
