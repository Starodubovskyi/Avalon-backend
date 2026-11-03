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
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  MAP_POINT_LOGO_CACHE_CONTROL,
  MAP_POINT_LOGO_MIME_TYPES,
} from './map-point.constants';

type AuthRequest = { user: JwtPayloadType };

const WRITE_ERRORS_DESCRIPTION =
  '{ errors: { activities: "premiumRequired" | "invalid", logo: "invalid" | "tooLong", ... } }';

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
    type: MapPointView,
  })
  @ApiUnprocessableEntityResponse({ description: WRITE_ERRORS_DESCRIPTION })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: AuthRequest,
    @Body() createMapPointDto: CreateMapPointDto,
  ): Promise<MapPointView> {
    return this.mapPointsService.create(request.user.id, createMapPointDto);
  }

  @Get()
  @ApiOkResponse({
    type: [MapPointView],
    description: 'All team points, newest first (max 1000)',
  })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request: AuthRequest,
    @Query() query: QueryMapPointDto,
  ): Promise<MapPointView[]> {
    return this.mapPointsService.findAll(request.user.id, query);
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
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointView> {
    return this.mapPointsService.findById(request.user.id, id);
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
  @ApiNotFoundResponse({ description: 'No such point, or it has no logo' })
  async getLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const logo = await this.mapPointsService.getLogo(id);
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
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({ description: WRITE_ERRORS_DESCRIPTION })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMapPointDto: UpdateMapPointDto,
  ): Promise<MapPointView> {
    return this.mapPointsService.update(request.user.id, id, updateMapPointDto);
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
    return this.mapPointsService.setFavorite(request.user.id, id, true);
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
    return this.mapPointsService.setFavorite(request.user.id, id, false);
  }
}
