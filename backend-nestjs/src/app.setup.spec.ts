import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './app.setup';

class EchoBody {
  @IsString()
  name!: string;
}

class EchoQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

@Controller('echo')
class EchoController {
  @Post()
  body(@Body() body: EchoBody): EchoBody {
    return body;
  }

  @Get()
  query(@Query() query: EchoQuery): { month: number; type: string } {
    return { month: query.month, type: typeof query.month };
  }
}

describe('configureApp (request pipeline)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EchoController],
    }).compile();
    app = configureApp(
      moduleRef.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves routes under /api/v1', async () => {
    await request(app.getHttpServer()).get('/echo?month=1').expect(404);
    await request(app.getHttpServer()).get('/api/v1/echo?month=1').expect(200);
  });

  it('accepts a valid body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/echo')
      .send({ name: 'copra' })
      .expect(201)
      .expect({ name: 'copra' });
  });

  it('rejects an invalid body with the default error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/echo')
      .send({ name: 42 })
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect((res.body as { message: string[] }).message).toEqual([
      'name must be a string',
    ]);
  });

  it('rejects unknown fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/echo')
      .send({ name: 'copra', isAdmin: true })
      .expect(400);
    expect((res.body as { message: string[] }).message).toEqual([
      'property isAdmin should not exist',
    ]);
  });

  it('converts and validates query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/echo?month=3')
      .expect(200)
      .expect({ month: 3, type: 'number' });
    await request(app.getHttpServer()).get('/api/v1/echo?month=13').expect(400);
  });
});
