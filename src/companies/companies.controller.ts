import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { MapPointView } from '../map-points/domain/map-point-view';
import { toNetworkActor } from '../users-directory/user-visibility';
import { CompaniesService } from './companies.service';
import { CompanyMember, CompanyProfile } from './domain/company';
import { JoinCompanyDto } from './dto/join-company.dto';
import { UpdateCompanyMemberDto } from './dto/update-company-member.dto';

type AuthRequest = { user: JwtPayloadType };

/** Company profiles of map points and their teams ("I work here"). */
@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'companies',
  version: '1',
})
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // Declared before :pointId so "mine" is not parsed as an id.
  @Get('mine')
  @ApiOkResponse({
    type: [MapPointView],
    description:
      'My points and the points where I am an active member, newest first',
  })
  @HttpCode(HttpStatus.OK)
  findMine(@Request() request: AuthRequest): Promise<MapPointView[]> {
    return this.companiesService.findMine(toNetworkActor(request.user));
  }

  @Get(':pointId')
  @ApiParam({ name: 'pointId', type: String, required: true })
  @ApiOkResponse({ type: CompanyProfile })
  @ApiNotFoundResponse({ description: 'Missing, deleted or not visible' })
  @HttpCode(HttpStatus.OK)
  getProfile(
    @Request() request: AuthRequest,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
  ): Promise<CompanyProfile> {
    return this.companiesService.getProfile(
      toNetworkActor(request.user),
      pointId,
    );
  }

  @Post(':pointId/join')
  @ApiParam({ name: 'pointId', type: String, required: true })
  @ApiOkResponse({
    type: CompanyProfile,
    description: '"I work here": a pending request for the owner / team',
  })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { membership: "exists" | "owner" } }',
  })
  @HttpCode(HttpStatus.OK)
  join(
    @Request() request: AuthRequest,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
    @Body() dto: JoinCompanyDto,
  ): Promise<CompanyProfile> {
    return this.companiesService.join(
      toNetworkActor(request.user),
      pointId,
      dto,
    );
  }

  @Delete(':pointId/members/me')
  @ApiParam({ name: 'pointId', type: String, required: true })
  @ApiNoContentResponse({
    description: 'Left the team (or withdrew the request)',
  })
  @ApiNotFoundResponse({ description: 'Not a member' })
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @Request() request: AuthRequest,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
  ): Promise<void> {
    return this.companiesService.leave(toNetworkActor(request.user), pointId);
  }

  @Patch(':pointId/members/:userId')
  @ApiParam({ name: 'pointId', type: String, required: true })
  @ApiParam({ name: 'userId', type: Number, required: true })
  @ApiOkResponse({
    type: CompanyMember,
    description: 'Owner or admin/staff: approve and/or set the position',
  })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'No such point or membership' })
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { status: "invalid", position: "tooLong" } }',
  })
  @HttpCode(HttpStatus.OK)
  updateMember(
    @Request() request: AuthRequest,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateCompanyMemberDto,
  ): Promise<CompanyMember> {
    return this.companiesService.updateMember(
      toNetworkActor(request.user),
      pointId,
      userId,
      dto,
    );
  }

  @Delete(':pointId/members/:userId')
  @ApiParam({ name: 'pointId', type: String, required: true })
  @ApiParam({ name: 'userId', type: Number, required: true })
  @ApiNoContentResponse({
    description: 'Owner or admin/staff: decline a request or remove a member',
  })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'No such point or membership' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Request() request: AuthRequest,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    return this.companiesService.removeMember(
      toNetworkActor(request.user),
      pointId,
      userId,
    );
  }
}
