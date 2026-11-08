import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

/**
 * Runs against the real backend-nestjs/.env and the shared Supabase project.
 * READ ONLY: admin tests only send requests that fail auth or validation,
 * which are rejected before any database write. Assertions check invariants
 * (rules 2 and 3), not values that change with each monthly run.
 */
describe('API (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health reads Supabase', () => {
    return http()
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok', database: 'ok' });
  });

  it('GET /prices/latest', async () => {
    const res = await http().get('/api/v1/prices/latest').expect(200);
    expect(res.body).toEqual({
      month: expect.stringMatching(/^\d{4}-\d{2}-01$/) as string,
      pricePhpKg: expect.any(Number) as number,
      previousPricePhpKg: expect.any(Number) as number,
      changePct: expect.any(Number) as number,
    });
  });

  it('GET /prices/areas: six areas for the latest month', async () => {
    const res = await http().get('/api/v1/prices/areas').expect(200);
    const body = res.body as { month: string; areas: { name: string }[] };
    expect(body.areas.map((a) => a.name)).toEqual([
      'Davao City',
      'Davao de Oro',
      'Davao del Norte',
      'Davao del Sur',
      'Davao Occidental',
      'Davao Oriental',
    ]);
  });

  it('GET /prices/history validates and filters', async () => {
    await http().get('/api/v1/prices/history?from=2025-01-15').expect(400);
    const res = await http()
      .get('/api/v1/prices/history?from=2025-01-01&to=2025-12-01')
      .expect(200);
    expect(res.body).toHaveLength(12);
  });

  it('GET /forecast/latest: naive reference, typical error from the regime', async () => {
    const res = await http().get('/api/v1/forecast/latest').expect(200);
    const body = res.body as {
      reference: { model: string; pricePhpKg: number };
      regime: { label: string; pHighVolatility: number };
      typicalError: { pricePhpKg: number; low: number; high: number };
      models: { model: string }[];
    };
    expect(body.reference.model).toBe('naive');
    expect(body.models[0].model).toBe('naive');
    expect(body.regime.label).toBe(
      body.regime.pHighVolatility > 0.5 ? 'high' : 'low',
    );
    expect(body.typicalError.pricePhpKg).toBe(
      body.regime.label === 'high' ? 6.47 : 1.3,
    );
    expect(body.typicalError.low).toBeCloseTo(
      body.reference.pricePhpKg - body.typicalError.pricePhpKg,
      1,
    );
  });

  it('GET /regime/history, /metrics, /backtest', async () => {
    const regime = await http().get('/api/v1/regime/history').expect(200);
    expect((regime.body as unknown[]).length).toBeGreaterThan(0);

    const metrics = await http().get('/api/v1/metrics').expect(200);
    expect(metrics.body).toHaveLength(24);

    const backtest = await http().get('/api/v1/backtest').expect(200);
    const bt = backtest.body as { dataThrough: string; months: unknown[] };
    expect(bt.dataThrough).toBe('2023-12-01');
    expect(bt.months).toHaveLength(24);
  });

  describe('admin (no writes)', () => {
    it('rejects requests without the admin key', async () => {
      await http().post('/api/v1/admin/monthly-data').send({}).expect(401);
      await http().post('/api/v1/admin/annual-exports').send({}).expect(401);
      await http().post('/api/v1/admin/runs').send({}).expect(401);
      await http()
        .get('/api/v1/admin/runs/00000000-0000-4000-8000-000000000000')
        .set('x-admin-key', 'wrong')
        .expect(401);
    });

    it('rejects invalid bodies before touching the database', async () => {
      const key = process.env.ADMIN_API_KEY ?? '';
      const res = await http()
        .post('/api/v1/admin/monthly-data')
        .set('x-admin-key', key)
        .send({ month: '2026-01-15', rhPct: 120 })
        .expect(400);
      expect((res.body as { message: string[] }).message).toEqual(
        expect.arrayContaining([
          'month must be the first day of a month (YYYY-MM-01)',
          'rhPct must not be greater than 100',
        ]),
      );
      await http()
        .get('/api/v1/admin/runs/not-a-uuid')
        .set('x-admin-key', key)
        .expect(400);
    });
  });
});
