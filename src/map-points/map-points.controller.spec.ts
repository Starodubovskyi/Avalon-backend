import {
  ClassSerializerInterceptor,
  INestApplication,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolesGuard } from '../roles/roles.guard';
import { ResolvePromisesInterceptor } from '../utils/serializer.interceptor';
import validationOptions from '../utils/validation-options';
import { MapPointsController } from './map-points.controller';
import { MapPointsService } from './map-points.service';

const POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('MapPointsController GET /map-points/:id/logo', () => {
  let app: INestApplication;
  let service: { getLogo: jest.Mock };

  const webpBytes = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x1a, 0, 0, 0]),
    Buffer.from('WEBPVP8L'),
    Buffer.alloc(16, 9),
  ]);

  beforeAll(async () => {
    service = { getLogo: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [MapPointsController],
      providers: [{ provide: MapPointsService, useValue: service }],
    })
      // Access control is covered by the guards themselves; here: the response.
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    // Same global pipeline as main.ts: the interceptors must not break @Res().
    app.useGlobalPipes(new ValidationPipe(validationOptions));
    app.useGlobalInterceptors(
      new ResolvePromisesInterceptor(),
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.getLogo.mockReset();
  });

  it('should return the decoded bytes with the stored type, nosniff and an immutable private cache', async () => {
    service.getLogo.mockResolvedValue({
      mimeType: 'image/webp',
      bytes: webpBytes,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/map-points/${POINT_ID}/logo?v=1793700000000`)
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => done(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(service.getLogo).toHaveBeenCalledWith(POINT_ID);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['content-length']).toBe(String(webpBytes.length));
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe(
      'private, max-age=31536000, immutable',
    );
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).equals(webpBytes)).toBe(true);
  });

  it('should return 404 without the immutable cache header when there is no logo', async () => {
    service.getLogo.mockRejectedValue(new NotFoundException('Logo not found'));

    const res = await request(app.getHttpServer()).get(
      `/v1/map-points/${POINT_ID}/logo`,
    );

    expect(res.status).toBe(404);
    expect(res.headers['cache-control'] ?? '').not.toContain('immutable');
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('should reject an id that is not a UUID before reaching the service', async () => {
    const res = await request(app.getHttpServer()).get(
      '/v1/map-points/not-a-uuid/logo',
    );

    expect(res.status).toBe(400);
    expect(service.getLogo).not.toHaveBeenCalled();
  });
});
