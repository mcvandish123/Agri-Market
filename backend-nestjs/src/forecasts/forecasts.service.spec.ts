import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Db } from '../supabase/supabase.module';
import { fakeSupabase } from '../testing/fake-supabase';
import {
  forecasts,
  LIVE_RUN,
  regimeProbabilities,
  tables,
} from '../testing/fixtures';
import { ForecastsService } from './forecasts.service';

type Tables = ReturnType<typeof tables>;

const service = (overrides: Partial<Record<keyof Tables, unknown[]>> = {}) =>
  new ForecastsService(
    fakeSupabase({ ...tables(), ...overrides } as Record<
      string,
      Record<string, unknown>[]
    >).client as Db,
  );

describe('ForecastsService', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterAll(() => jest.restoreAllMocks());

  describe('latest', () => {
    it('returns the naive reference with the high-regime typical error', async () => {
      const res = await service().latest();
      expect(res).toMatchObject({
        targetMonth: '2026-01-01',
        dataThrough: '2025-12-01',
        reference: { model: 'naive', pricePhpKg: 60.28 },
        regime: { label: 'high', pHighVolatility: 0.51 },
        typicalError: { pricePhpKg: 6.47, low: 53.81, high: 66.75 },
      });
    });

    it('lists every model, naive first, in a fixed order', async () => {
      const res = await service().latest();
      expect(res.models.map((m) => m.model)).toEqual([
        'naive',
        'sarimax',
        'xgboost_full',
        'xgboost_rfe',
        'ms_xgboost_rfe',
        'lstm',
      ]);
      expect(res.models[5].pricePhpKg).toBe(61.18);
    });

    it('uses the low-regime RMSE when the latest month is calm', async () => {
      const calm = regimeProbabilities.map((r) =>
        r.month === '2025-12-01' && r.run_id === LIVE_RUN
          ? { ...r, p_high_volatility: 0.06, regime: 'low' }
          : r,
      );
      const res = await service({ regime_probabilities: calm }).latest();
      expect(res.regime).toEqual({ label: 'low', pHighVolatility: 0.06 });
      expect(res.typicalError).toEqual({
        pricePhpKg: 1.3,
        low: 58.98,
        high: 61.58,
      });
    });

    it('returns 404 before any live run has succeeded', async () => {
      await expect(
        service({ latest_live_run: [] }).latest(),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fails (500) if the reference forecast is missing or not naive', async () => {
      const noRef = forecasts.map((f) => ({ ...f, is_reference: false }));
      await expect(
        service({ forecasts: noRef }).latest(),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      const wrongRef = forecasts.map((f) => ({
        ...f,
        is_reference: f.model_name === 'lstm',
      }));
      await expect(
        service({ forecasts: wrongRef }).latest(),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('fails (500) if the regime for the data month is missing', async () => {
      await expect(
        service({ regime_probabilities: [] }).latest(),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  it('regimeHistory returns the latest live run only, oldest first', async () => {
    await expect(service().regimeHistory()).resolves.toEqual([
      { month: '2025-11-01', pHighVolatility: 0.503, label: 'high' },
      { month: '2025-12-01', pHighVolatility: 0.51, label: 'high' },
    ]);
  });

  it('metrics are camelCase, naive first, in evaluation-set order', async () => {
    const res = await service().metrics();
    expect(res.map((m) => `${m.model}/${m.evaluationSet}`)).toEqual([
      'naive/cv',
      'naive/test',
      'naive/test_low_volatility',
      'naive/test_high_volatility',
      'sarimax/test',
    ]);
    expect(res[0]).toEqual({
      model: 'naive',
      evaluationSet: 'cv',
      rmse: 2.78,
      rmseSd: null,
      mae: null,
      maeSd: null,
      mapePct: null,
      mapeSd: null,
      r2: null,
      nMonths: null,
    });
  });

  describe('backtest', () => {
    it('joins each month with the actual price', async () => {
      const res = await service().backtest();
      expect(res.dataThrough).toBe('2023-12-01');
      expect(res.referenceModel).toBe('naive');
      expect(res.months).toEqual([
        {
          month: '2024-01-01',
          actualPricePhpKg: 26.75,
          forecasts: [
            { model: 'naive', pricePhpKg: 26.99 },
            { model: 'sarimax', pricePhpKg: 27.39 },
          ],
        },
        {
          month: '2024-02-01',
          actualPricePhpKg: null, // not in the price fixture
          forecasts: [{ model: 'naive', pricePhpKg: 26.75 }],
        },
      ]);
    });

    it('returns 404 without a backtest run', async () => {
      await expect(
        service({ model_runs: [] }).backtest(),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
