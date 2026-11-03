import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
import { isTeamRole, NetworkActor } from '../users-directory/user-visibility';
import { unprocessable } from '../utils/unprocessable';
import { MapPoint } from './domain/map-point';
import {
  MapPointEmailConfirmation,
  MapPointEmailVerificationSent,
  MapPointView,
} from './domain/map-point-view';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import {
  POINT_EMAIL_RESEND_SECONDS,
  POINT_EMAIL_TOKEN_EXPIRES,
  POINT_EMAIL_TOKEN_PURPOSE,
} from './map-point.constants';
import { MapPointPresenter } from './map-point.presenter';
import { MapPointsService } from './map-points.service';

interface PointEmailTokenPayload {
  purpose: typeof POINT_EMAIL_TOKEN_PURPOSE;
  pointId: string;
  email: string;
}

/**
 * Confirms the contact email of a point by link: a JWT signed with the
 * confirm-email secret, carrying the point, the email and a `purpose` claim
 * (account confirmation tokens are rejected). The link only verifies the
 * email it was sent to: after a change it is stale.
 */
@Injectable()
export class MapPointEmailVerificationService {
  private readonly logger = new Logger(MapPointEmailVerificationService.name);

  constructor(
    private readonly mapPointsService: MapPointsService,
    private readonly mapPointRepository: MapPointRepository,
    private readonly presenter: MapPointPresenter,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly mailService: MailService,
  ) {}

  /**
   * Owner or team. 422 { email: "missing" | "alreadyVerified" | "tooSoon" |
   * "stale" } (one email per minute; stale = the email changed during the
   * request); 503 { email: "mailUnavailable" } when the mail server fails
   * (the minute is not used up then). Signing happens before the mail
   * attempt, so a configuration error is a 500, not a 503.
   */
  async send(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPointEmailVerificationSent> {
    const point = await this.mapPointsService.getEditablePoint(actor, id);
    if (!point.email) {
      throw unprocessable('email', 'missing');
    }
    if (point.emailVerified) {
      throw unprocessable('email', 'alreadyVerified');
    }
    const token = await this.signToken(point.id, point.email);
    const reservation = await this.mapPointRepository.reserveEmailVerification(
      id,
      point.email,
      POINT_EMAIL_RESEND_SECONDS,
    );
    if (!reservation) {
      throw await this.notReservedReason(actor, point);
    }

    try {
      await this.mailService.pointEmailVerification({
        to: point.email,
        data: { token, pointTitle: point.firstName },
      });
    } catch (error) {
      // Never the message: SMTP errors quote the recipient address.
      this.logger.warn(
        `Point email verification was not sent for point ${point.id}: ${describeMailError(error)}`,
      );
      await this.mapPointRepository.releaseEmailVerification(
        id,
        reservation.previousSentAt,
      );
      throw new ServiceUnavailableException({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        errors: { email: 'mailUnavailable' },
      });
    }
    const sent = new MapPointEmailVerificationSent();
    sent.sent = true;
    return sent;
  }

  /** Team only (e.g. when mail is not configured). 422 { email: "missing" }. */
  async markVerified(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPointView> {
    if (!isTeamRole(actor.roleId)) {
      throw new ForbiddenException();
    }
    const point = await this.mapPointsService.getVisiblePoint(actor, id);
    if (!point.email) {
      throw unprocessable('email', 'missing');
    }
    // Only the email the team looked at: a change meanwhile is not verified.
    if (!(await this.mapPointRepository.markEmailVerified(id, point.email))) {
      throw unprocessable('email', 'stale');
    }
    return this.presenter.presentOne(
      actor,
      await this.mapPointsService.getVisiblePoint(actor, id),
    );
  }

  /**
   * Public (the link is opened from a mailbox). Idempotent for the same
   * email. 422 { token: "invalid" | "expired" | "stale" }.
   */
  async confirm(token: string): Promise<MapPointEmailConfirmation> {
    const payload = await this.verifyToken(token);
    const point = await this.mapPointRepository.findById(payload.pointId);
    if (!point) {
      throw unprocessable('token', 'invalid');
    }
    if (
      point.email !== payload.email ||
      !(await this.mapPointRepository.markEmailVerified(
        point.id,
        payload.email,
      ))
    ) {
      throw unprocessable('token', 'stale');
    }
    const confirmation = new MapPointEmailConfirmation();
    confirmation.pointId = point.id;
    confirmation.title = point.firstName;
    confirmation.email = payload.email;
    return confirmation;
  }

  private signToken(pointId: string, email: string): Promise<string> {
    const payload: PointEmailTokenPayload = {
      purpose: POINT_EMAIL_TOKEN_PURPOSE,
      pointId,
      email,
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
        infer: true,
      }),
      expiresIn: POINT_EMAIL_TOKEN_EXPIRES,
    });
  }

  /** Why the send could not be recorded, from a fresh read of the point. */
  private async notReservedReason(
    actor: NetworkActor,
    sent: MapPoint,
  ): Promise<UnprocessableEntityException> {
    const fresh = await this.mapPointsService.getEditablePoint(actor, sent.id);
    if (!fresh.email) {
      return unprocessable('email', 'missing');
    }
    if (fresh.email !== sent.email) {
      return unprocessable('email', 'stale');
    }
    if (fresh.emailVerified) {
      return unprocessable('email', 'alreadyVerified');
    }
    return unprocessable('email', 'tooSoon');
  }

  private async verifyToken(token: string): Promise<PointEmailTokenPayload> {
    let payload: Partial<PointEmailTokenPayload>;
    try {
      payload = await this.jwtService.verifyAsync<
        Partial<PointEmailTokenPayload>
      >(token, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
      });
    } catch (error) {
      throw unprocessable(
        'token',
        error instanceof TokenExpiredError ? 'expired' : 'invalid',
      );
    }
    if (
      payload.purpose !== POINT_EMAIL_TOKEN_PURPOSE ||
      typeof payload.pointId !== 'string' ||
      !isUUID(payload.pointId) ||
      typeof payload.email !== 'string'
    ) {
      throw unprocessable('token', 'invalid');
    }
    return {
      purpose: payload.purpose,
      pointId: payload.pointId,
      email: payload.email,
    };
  }
}

/** Error code and SMTP response code only (no message: it holds addresses). */
export function describeMailError(error: unknown): string {
  const details = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  const code = typeof details.code === 'string' ? details.code : 'unknown';
  const responseCode =
    typeof details.responseCode === 'number' ? details.responseCode : '-';
  return `code=${code} responseCode=${responseCode}`;
}
