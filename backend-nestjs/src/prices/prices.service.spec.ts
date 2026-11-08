import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Db } from '../supabase/supabase.module';
import { fakeSupabase } from '../testing/fake-supabase';
import { priceHistory } from '../testing/fixtures';
import { PricesService } from './prices.service';

const service = (rows = priceHistory, failOn?: string) =>
  new PricesService(
    fakeSupabase({ price_history: rows }, { failOn }).client as Db,
  );

describe('PricesService', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterAll(() => jest.restoreAllMocks());

  describe('latest', () => {
    it('returns the latest month and the change from the month before', async () => {
      await expect(service().latest()).resolves.toEqual({
        month: '2025-12-01',
        pricePhpKg: 60.28,
        previousPricePhpKg: 63.03,
        changePct: -4.37, // from unrounded 63.033333, not 63.03
      });
    });

    it('has no change when only one month is observed', async () => {
      const res = await service([priceHistory[0]]).latest();
      expect(res.previousPricePhpKg).toBeNull();
      expect(res.changePct).toBeNull();
    });

    it('returns 404 with no prices', async () => {
      await expect(service([]).latest()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns a generic 500 on a database error', async () => {
      await expect(
        service(priceHistory, 'price_history').latest(),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('history', () => {
    it('returns all months oldest first, rounded to 2 decimals', async () => {
      const res = await service().history();
      expect(res.map((p) => p.month)).toEqual([
        '2024-01-01',
        '2025-10-01',
        '2025-11-01',
        '2025-12-01',
      ]);
      expect(res[1].pricePhpKg).toBe(62.91);
    });

    it('limits to an inclusive range', async () => {
      const res = await service().history('2025-11-01', '2025-12-01');
      expect(res.map((p) => p.month)).toEqual(['2025-11-01', '2025-12-01']);
    });

    it('rejects from after to', async () => {
      await expect(
        service().history('2025-12-01', '2025-01-01'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('areas', () => {
    const month = (m: string, base: number, valid = true) => ({
      month: m,
      price_valid: valid,
      farmgate_davao_city: base,
      farmgate_davao_de_oro: base + 1,
      farmgate_davao_del_norte: base + 2,
      farmgate_davao_del_sur: base + 3,
      farmgate_davao_occidental: null,
      farmgate_davao_oriental: base + 5,
    });
    const areaService = (rows: Record<string, unknown>[]) =>
      new PricesService(fakeSupabase({ monthly_data: rows }).client as Db);

    it('returns each area for the latest valid month with its change', async () => {
      const res = await areaService([
        month('2025-10-01', 10),
        month('2025-12-01', 60.84),
        month('2025-11-01', 63.2),
        month('2026-01-01', 99, false), // flagged invalid: ignored
      ]).areas();
      expect(res.month).toBe('2025-12-01');
      expect(res.previousMonth).toBe('2025-11-01');
      expect(res.areas.map((a) => a.area)).toEqual([
        'davao_city',
        'davao_de_oro',
        'davao_del_norte',
        'davao_del_sur',
        'davao_occidental',
        'davao_oriental',
      ]);
      expect(res.areas[0]).toEqual({
        area: 'davao_city',
        name: 'Davao City',
        pricePhpKg: 60.84,
        previousPricePhpKg: 63.2,
        changePct: -3.73,
      });
      // A missing area price gives nulls, not an error
      expect(res.areas[4]).toMatchObject({ pricePhpKg: null, changePct: null });
    });

    it('returns 404 with no valid month', async () => {
      await expect(areaService([]).areas()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
