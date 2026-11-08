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
});
