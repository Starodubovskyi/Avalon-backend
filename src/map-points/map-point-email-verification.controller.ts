import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { toNetworkActor } from '../users-directory/user-visibility';
import {
  MapPointEmailConfirmation,
  MapPointEmailVerificationSent,
  MapPointView,
} from './domain/map-point-view';
import { ConfirmPointEmailDto } from './dto/confirm-point-email.dto';
import { MapPointEmailVerificationService } from './map-point-email-verification.service';

type AuthRequest = { user: JwtPayloadType };

/**
 * Contact email confirmation of a point. Sending and "mark verified" need a
 * session (guards per route); confirming the link does not.
 */
@ApiTags('Map points')
@Controller({
  path: 'map-points',
  version: '1',
})
export class MapPointEmailVerificationController {
  constructor(
    private readonly verificationService: MapPointEmailVerificationService,
  ) {}

  @Post(':id/email-verification')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: MapPointEmailVerificationSent,
    description:
      'Emails a confirmation link (FRONTEND_DOMAIN/verify-email?token=…, valid 1 day) to the point email. Owner or admin/staff',
  })
  @ApiForbiddenResponse({ description: 'Not the owner (viewers)' })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { email: "missing" | "alreadyVerified" | "tooSoon" | "stale" } } (one email per 60 s; stale: the email changed during the request)',
  })
  @ApiServiceUnavailableResponse({
    description: '{ errors: { email: "mailUnavailable" } }',
  })
  @HttpCode(HttpStatus.OK)
  send(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointEmailVerificationSent> {
    return this.verificationService.send(toNetworkActor(request.user), id);
  }

  @Post(':id/email-verification/mark-verified')
  @ApiBearerAuth()
  @Roles(RoleEnum.admin, RoleEnum.staff)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: MapPointView,
    description: 'admin/staff: marks the current email verified by hand',
  })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { email: "missing" | "stale" } }',
  })
  @HttpCode(HttpStatus.OK)
  markVerified(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MapPointView> {
    return this.verificationService.markVerified(
      toNetworkActor(request.user),
      id,
    );
  }

  @Post('email-verification/confirm')
  @ApiOkResponse({
    type: MapPointEmailConfirmation,
    description: 'Public: confirms the email from the link. Idempotent',
  })
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { token: "invalid" | "expired" | "stale" } } (stale: the point email changed since)',
  })
  @HttpCode(HttpStatus.OK)
  confirm(
    @Body() dto: ConfirmPointEmailDto,
  ): Promise<MapPointEmailConfirmation> {
    return this.verificationService.confirm(dto.token);
  }
}
