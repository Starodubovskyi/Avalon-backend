import {
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
import { RoleEnum } from '../roles/roles.enum';
import { NetworkActor } from '../users-directory/user-visibility';
import { MapPoint } from './domain/map-point';
import { MapPointView } from './domain/map-point-view';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import {
  describeMailError,
  MapPointEmailVerificationService,
} from './map-point-email-verification.service';
import { MapPointPresenter } from './map-point.presenter';
import { MapPointsService } from './map-points.service';

const OWNER: NetworkActor = { userId: 7, roleId: RoleEnum.user };
const STAFF: NetworkActor = { userId: 3, roleId: RoleEnum.staff };
const SECRET = 'test-confirm-email-secret';
const POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('MapPointEmailVerificationService', () => {
  const point = {
    id: POINT_ID,
    userId: 7,
    visibility: 'public',
    firstName: 'Avalon Shipping',
    email: 'office@avalon.example',
    emailVerified: false,
  } as MapPoint;

  const jwt = new JwtService({});
  let points: { getEditablePoint: jest.Mock; getVisiblePoint: jest.Mock };
  let repo: {
    findById: jest.Mock;
    reserveEmailVerification: jest.Mock;
    releaseEmailVerification: jest.Mock;
    markEmailVerified: jest.Mock;
  };
  let mail: { pointEmailVerification: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let service: MapPointEmailVerificationService;

  const sign = (payload: object) =>
    jwt.signAsync(payload, { secret: SECRET, expiresIn: '1d' });

  beforeEach(() => {
    points = {
      getEditablePoint: jest.fn().mockResolvedValue(point),
      getVisiblePoint: jest.fn().mockResolvedValue(point),
    };
    repo = {
      findById: jest.fn().mockResolvedValue(point),
      reserveEmailVerification: jest
        .fn()
        .mockResolvedValue({ previousSentAt: null }),
      releaseEmailVerification: jest.fn().mockResolvedValue(undefined),
      markEmailVerified: jest.fn().mockResolvedValue(true),
    };
    mail = { pointEmailVerification: jest.fn().mockResolvedValue(undefined) };
    // The account-email lifetime must not be used for point links.
    config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'auth.confirmEmailSecret' ? SECRET : '7d',
      ),
    };
    service = new MapPointEmailVerificationService(
      points as unknown as MapPointsService,
      repo as unknown as MapPointRepository,
      {
        presentOne: (_actor: NetworkActor, p: MapPoint) =>
          Promise.resolve(p as MapPointView),
      } as unknown as MapPointPresenter,
      jwt,
      config as unknown as ConfigService<AllConfigType>,
      mail as unknown as MailService,
    );
  });

  describe('send', () => {
    it('should email a link token with the point, the email and the purpose', async () => {
      await expect(service.send(OWNER, POINT_ID)).resolves.toEqual({
        sent: true,
      });

      expect(repo.reserveEmailVerification).toHaveBeenCalledWith(
        POINT_ID,
        'office@avalon.example',
        60,
      );
      const [[mailData]] = mail.pointEmailVerification.mock.calls as [
        [{ to: string; data: { token: string; pointTitle: string } }],
      ];
      expect(mailData.to).toBe('office@avalon.example');
      expect(mailData.data.pointTitle).toBe('Avalon Shipping');
      const decoded = await jwt.verifyAsync<{ iat: number; exp: number }>(
        mailData.data.token,
        { secret: SECRET },
      );
      expect(decoded).toMatchObject({
        purpose: 'map-point-email',
        pointId: POINT_ID,
        email: 'office@avalon.example',
      });
      // own constant: 1 day, whatever AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN says
      expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
      expect(config.getOrThrow).not.toHaveBeenCalledWith(
        'auth.confirmEmailExpires',
        expect.anything(),
      );
    });

    it('should fail before reserving or mailing when signing fails (not a 503)', async () => {
      config.getOrThrow.mockImplementation(() => {
        throw new Error('auth.confirmEmailSecret is missing');
      });

      const error = await service
        .send(OWNER, POINT_ID)
        .catch((e: unknown) => e);

      expect(error).not.toBeInstanceOf(ServiceUnavailableException);
      expect(repo.reserveEmailVerification).not.toHaveBeenCalled();
      expect(mail.pointEmailVerification).not.toHaveBeenCalled();
    });

    it('should return 422 missing without an email', async () => {
      points.getEditablePoint.mockResolvedValue({ ...point, email: null });
      await expect(service.send(OWNER, POINT_ID)).rejects.toMatchObject({
        response: { status: 422, errors: { email: 'missing' } },
      });
      expect(mail.pointEmailVerification).not.toHaveBeenCalled();
    });

    it('should return 422 alreadyVerified', async () => {
      points.getEditablePoint.mockResolvedValue({
        ...point,
        emailVerified: true,
      });
      await expect(service.send(OWNER, POINT_ID)).rejects.toMatchObject({
        response: { errors: { email: 'alreadyVerified' } },
      });
    });

    it('should return 422 tooSoon within a minute of the last email', async () => {
      repo.reserveEmailVerification.mockResolvedValue(null);
      await expect(service.send(OWNER, POINT_ID)).rejects.toMatchObject({
        response: { errors: { email: 'tooSoon' } },
      });
      expect(mail.pointEmailVerification).not.toHaveBeenCalled();
    });

    it('should report the real cause when the send could not be recorded', async () => {
      repo.reserveEmailVerification.mockResolvedValue(null);

      points.getEditablePoint
        .mockResolvedValueOnce(point)
        .mockResolvedValueOnce({ ...point, emailVerified: true });
      await expect(service.send(OWNER, POINT_ID)).rejects.toMatchObject({
        response: { errors: { email: 'alreadyVerified' } },
      });

      points.getEditablePoint
        .mockResolvedValueOnce(point)
        .mockResolvedValueOnce({ ...point, email: 'new@avalon.example' });
      await expect(service.send(OWNER, POINT_ID)).rejects.toMatchObject({
        response: { errors: { email: 'stale' } },
      });

      expect(mail.pointEmailVerification).not.toHaveBeenCalled();
    });

    it('should return 503 mailUnavailable and give the minute back when sending fails', async () => {
      const previousSentAt = new Date('2026-11-03T10:00:00.000Z');
      repo.reserveEmailVerification.mockResolvedValue({ previousSentAt });
      mail.pointEmailVerification.mockRejectedValue(
        Object.assign(
          new Error('550 mailbox office@avalon.example unavailable'),
          { code: 'EENVELOPE', responseCode: 550 },
        ),
      );
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const error = await service
        .send(OWNER, POINT_ID)
        .catch((e: unknown) => e);

      // the point id and codes only: no address from the SMTP message
      expect(warn).toHaveBeenCalledWith(
        `Point email verification was not sent for point ${POINT_ID}: code=EENVELOPE responseCode=550`,
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('@');
      warn.mockRestore();

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error).toMatchObject({
        response: { status: 503, errors: { email: 'mailUnavailable' } },
      });
      expect(repo.releaseEmailVerification).toHaveBeenCalledWith(
        POINT_ID,
        previousSentAt,
      );
    });
  });

  describe('markVerified', () => {
    it('should let the team mark the current email verified', async () => {
      await service.markVerified(STAFF, POINT_ID);
      expect(repo.markEmailVerified).toHaveBeenCalledWith(
        POINT_ID,
        'office@avalon.example',
      );
    });

    it('should return 422 stale when the email changed meanwhile', async () => {
      repo.markEmailVerified.mockResolvedValue(false);
      await expect(service.markVerified(STAFF, POINT_ID)).rejects.toMatchObject(
        { response: { errors: { email: 'stale' } } },
      );
    });

    it('should refuse viewers and points without an email', async () => {
      await expect(
        service.markVerified(OWNER, POINT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      points.getVisiblePoint.mockResolvedValue({ ...point, email: null });
      await expect(service.markVerified(STAFF, POINT_ID)).rejects.toMatchObject(
        { response: { errors: { email: 'missing' } } },
      );
    });
  });

  describe('confirm', () => {
    const payload = {
      purpose: 'map-point-email',
      pointId: POINT_ID,
      email: 'office@avalon.example',
    };

    it('should verify the email the link was sent to', async () => {
      await expect(service.confirm(await sign(payload))).resolves.toEqual({
        pointId: POINT_ID,
        title: 'Avalon Shipping',
        email: 'office@avalon.example',
      });
      expect(repo.markEmailVerified).toHaveBeenCalledWith(
        POINT_ID,
        'office@avalon.example',
      );
    });

    it('should return 422 invalid for garbage, a wrong secret or another purpose', async () => {
      const wrongSecret = await jwt.signAsync(payload, { secret: 'other' });
      const accountToken = await sign({ confirmEmailUserId: 7 });
      for (const token of ['not-a-jwt', wrongSecret, accountToken]) {
        await expect(service.confirm(token)).rejects.toMatchObject({
          response: { status: 422, errors: { token: 'invalid' } },
        });
      }
      expect(repo.markEmailVerified).not.toHaveBeenCalled();
    });

    it('should return 422 expired for an expired link', async () => {
      // exp in the payload (no expiresIn): a link that expired a minute ago
      const expired = await jwt.signAsync(
        { ...payload, exp: Math.floor(Date.now() / 1000) - 60 },
        { secret: SECRET },
      );
      await expect(service.confirm(expired)).rejects.toMatchObject({
        response: { errors: { token: 'expired' } },
      });
    });

    it('should return 422 stale when the point email changed since', async () => {
      repo.findById.mockResolvedValue({
        ...point,
        email: 'new@avalon.example',
      });
      await expect(service.confirm(await sign(payload))).rejects.toMatchObject({
        response: { errors: { token: 'stale' } },
      });
      expect(repo.markEmailVerified).not.toHaveBeenCalled();
    });

    it('should return 422 invalid for a deleted point', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.confirm(await sign(payload))).rejects.toMatchObject({
        response: { errors: { token: 'invalid' } },
      });
    });
  });
});

describe('describeMailError', () => {
  it('should keep codes and drop the message', () => {
    expect(
      describeMailError(
        Object.assign(new Error('to x@y.z failed'), {
          code: 'ECONNECTION',
        }),
      ),
    ).toBe('code=ECONNECTION responseCode=-');
    expect(describeMailError('boom')).toBe('code=unknown responseCode=-');
    expect(describeMailError(null)).toBe('code=unknown responseCode=-');
  });
});
