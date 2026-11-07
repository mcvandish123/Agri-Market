import type { Db } from '../supabase/supabase.module';
import { fakeSupabase } from '../testing/fake-supabase';
import { AdminDataService } from './admin-data.service';
import { MonthlyDataDto } from './admin.dto';
import { vpdKpa } from './vpd';

// The real December 2025 row (supabase/seed.sql)
const dec2025: MonthlyDataDto = {
  month: '2025-12-01',
  farmgateDavaoCity: 60.84,
  farmgateDavaoDeOro: 60.38,
  farmgateDavaoDelNorte: 63.54,
  farmgateDavaoDelSur: 60.15,
  farmgateDavaoOccidental: 55.17,
  farmgateDavaoOriental: 61.6,
  cpiRegion11: 131.4,
  tempC: 28.4,
  rhPct: 76,
  rainMm: 92.9,
  coconutOilUsdMt: 2323,
  palmOilUsdMt: 980,
  palmKernelOilUsdMt: 1993,
  soybeanOilUsdMt: 1116,
  phpUsd: 58.8488,
};

describe('vpdKpa', () => {
  it('matches the stored value computed by the thesis pipeline', () => {
    expect(vpdKpa(28.4, 76)).toBe(0.928497);
  });

  it('is zero at 100% humidity', () => {
    expect(vpdKpa(30, 100)).toBe(0);
  });
});

describe('AdminDataService', () => {
  it('maps monthly data to snake_case and computes VPD server-side', async () => {
    const fake = fakeSupabase({});
    const res = await new AdminDataService(fake.client as Db).upsertMonthlyData(
      dec2025,
    );

    const [row] = fake.upserts.monthly_data;
    expect(row).toMatchObject({
      month: '2025-12-01',
      farmgate_davao_city: 60.84,
      farmgate_davao_oriental: 61.6,
      rh_pct: 76,
      vpd_kpa: 0.928497,
      php_usd: 58.8488,
      source_note: null,
    });
    expect(Object.keys(row)).toHaveLength(18);
    // Generated column and the validity flag are never written by the API
    expect(row).not.toHaveProperty('farmgate_regional_avg');
    expect(row).not.toHaveProperty('price_valid');
    // Response is the stored row in camelCase
    expect(res).toMatchObject({ month: '2025-12-01', vpdKpa: 0.928497 });
  });

  it('upserts annual exports', async () => {
    const fake = fakeSupabase({});
    const res = await new AdminDataService(
      fake.client as Db,
    ).upsertAnnualExports({
      year: 2025,
      unitValueUsdKg: 1.52,
      sourceNote: 'PSA',
    });
    expect(fake.upserts.annual_exports).toEqual([
      { year: 2025, unit_value_usd_kg: 1.52, source_note: 'PSA' },
    ]);
    expect(res).toMatchObject({ year: 2025, unitValueUsdKg: 1.52 });
  });
});
