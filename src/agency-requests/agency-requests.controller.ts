import {
  Body,
  Controller,
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
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { toNetworkActor } from '../users-directory/user-visibility';
import { AgencyRequestsService } from './agency-requests.service';
import { AgencyRequest } from './domain/agency-request';
import { CreateAgencyRequestDto } from './dto/create-agency-request.dto';
import { QueryAgencyRequestDto } from './dto/query-agency-request.dto';
import { UpdateAgencyRequestDto } from './dto/update-agency-request.dto';

type AuthRequest = { user: JwtPayloadType };

@ApiTags('Agency requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'agency-requests',
  version: '1',
})
export class AgencyRequestsController {
  constructor(private readonly agencyRequestsService: AgencyRequestsService) {}

  @Post()
  @ApiCreatedResponse({
    type: AgencyRequest,
    description: 'The author is the caller (JWT); status starts as new',
  })
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { field: code } }: empty | tooLong | invalidEmail | imoInvalid | invalid | invalidDateTime',
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: AuthRequest,
    @Body() dto: CreateAgencyRequestDto,
  ): Promise<AgencyRequest> {
    return this.agencyRequestsService.create(dto, toNetworkActor(request.user));
  }

  @Get()
  @ApiOkResponse({
    type: [AgencyRequest],
    description:
      'Newest first, at most 200. admin/staff: all requests; viewers: only their own',
  })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request: AuthRequest,
    @Query() query: QueryAgencyRequestDto,
  ): Promise<AgencyRequest[]> {
    return this.agencyRequestsService.findAll(
      query,
      toNetworkActor(request.user),
    );
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: AgencyRequest })
  @ApiNotFoundResponse({ description: "Missing, or another user's request" })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AgencyRequest> {
    return this.agencyRequestsService.findById(
      id,
      toNetworkActor(request.user),
    );
  }

  @Patch(':id')
  @Roles(RoleEnum.admin, RoleEnum.staff)
  @UseGuards(RolesGuard)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: AgencyRequest })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description:
      'Validation error or { errors: { vesselId: "notFound" } } for an unknown vessel',
  })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAgencyRequestDto,
  ): Promise<AgencyRequest> {
    return this.agencyRequestsService.update(
      id,
      dto,
      toNetworkActor(request.user),
    );
  }
}
