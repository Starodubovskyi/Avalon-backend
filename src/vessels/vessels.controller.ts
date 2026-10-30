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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { VesselView } from './domain/vessel-view';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { QueryVesselDto } from './dto/query-vessel.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import { VesselActor, VesselsService } from './vessels.service';

type AuthRequest = { user: JwtPayloadType };

function toActor(user: JwtPayloadType): VesselActor {
  return { userId: Number(user.id), roleId: user.role?.id };
}

@ApiTags('Vessels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'vessels',
  version: '1',
})
export class VesselsController {
  constructor(private readonly vesselsService: VesselsService) {}

  @Get()
  @ApiOkResponse({
    type: [VesselView],
    description:
      'Viewers (role user) get restricted=true with internal fields nulled',
  })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request: AuthRequest,
    @Query() query: QueryVesselDto,
  ): Promise<VesselView[]> {
    return this.vesselsService.findAll(query, request.user.role?.id);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: VesselView })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VesselView> {
    return this.vesselsService.findById(id, request.user.role?.id);
  }

  @Post()
  @Roles(RoleEnum.admin, RoleEnum.staff)
  @UseGuards(RolesGuard)
  @ApiCreatedResponse({ type: VesselView })
  @ApiForbiddenResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Validation error or { errors: { imo: "imoAlreadyExists" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: AuthRequest,
    @Body() createVesselDto: CreateVesselDto,
  ): Promise<VesselView> {
    return this.vesselsService.create(createVesselDto, toActor(request.user));
  }

  @Patch(':id')
  @Roles(RoleEnum.admin, RoleEnum.staff)
  @UseGuards(RolesGuard)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: VesselView })
  @ApiForbiddenResponse()
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateVesselDto: UpdateVesselDto,
  ): Promise<VesselView> {
    return this.vesselsService.update(
      id,
      updateVesselDto,
      toActor(request.user),
    );
  }

  @Delete(':id')
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.vesselsService.remove(id, Number(request.user.id));
  }
}
