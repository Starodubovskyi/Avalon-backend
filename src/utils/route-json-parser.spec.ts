import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { routeJsonParser } from './route-json-parser';

@Controller()
class EchoController {
  @Post('big')
  big(@Body() body: { text?: string }): { length: number } {
    return { length: body.text?.length ?? -1 };
  }

  @Post('other')
  other(@Body() body: { text?: string }): { length: number } {
    return { length: body.text?.length ?? -1 };
  }
}

describe('routeJsonParser', () => {
  let app: INestApplication;
  const large = { text: 'x'.repeat(150_000) }; // > 100 KB default limit

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EchoController],
    }).compile();
    app = moduleRef.createNestApplication();
    // As in main.ts: mounted before init(), i.e. before Nest's own parsers.
    app.use('/big', routeJsonParser('256kb'));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should not be named like the parser Nest looks for', () => {
    expect(routeJsonParser('256kb').name).not.toBe('jsonParser');
  });

  it('should accept a body above 100 KB on its route', async () => {
    const res = await request(app.getHttpServer()).post('/big').send(large);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ length: 150_000 });
  });

  it('should keep the default JSON parser (and its limit) on other routes', async () => {
    const small = await request(app.getHttpServer())
      .post('/other')
      .send({ text: 'abc' });
    expect(small.status).toBe(201);
    expect(small.body).toEqual({ length: 3 });

    const tooLarge = await request(app.getHttpServer())
      .post('/other')
      .send(large);
    expect(tooLarge.status).toBe(413);
  });
});
