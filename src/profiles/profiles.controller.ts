import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { toNetworkActor } from '../users-directory/user-visibility';
import { PersonProfile } from './domain/person-profile';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

type AuthRequest = { user: JwtPayloadType };

/** Personal pages (/people/[id]) and the caller's own profile fields. */
@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'profiles',
  version: '1',
})
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // Declared before :userId so "me" is not parsed as an id.
  @Get('me')
  @ApiOkResponse({ type: PersonProfile })
  @HttpCode(HttpStatus.OK)
  findMe(@Request() request: AuthRequest): Promise<PersonProfile> {
    const actor = toNetworkActor(request.user);
    return this.profilesService.findOne(actor, actor.userId);
  }

  @Patch('me')
  @ApiOkResponse({ type: PersonProfile })
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { headline | bio | phone: "invalid" | "tooLong", locale: "invalid" } }',
  })
  @HttpCode(HttpStatus.OK)
  updateMe(
    @Request() request: AuthRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<PersonProfile> {
    return this.profilesService.updateMe(toNetworkActor(request.user), dto);
  }

  @Get(':userId')
  @ApiParam({ name: 'userId', type: Number, required: true })
  @ApiOkResponse({ type: PersonProfile })
  @ApiNotFoundResponse({ description: 'Unknown, deleted or not visible' })
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() request: AuthRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<PersonProfile> {
    return this.profilesService.findOne(toNetworkActor(request.user), userId);
  }
}
