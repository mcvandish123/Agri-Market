import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { round } from '../common/format';
import type { Db } from '../supabase/supabase.module';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { unwrap } from '../supabase/supabase-result';

export interface LatestPriceResponse {
  month: string;
  pricePhpKg: number;
  previousPricePhpKg: number | null;
  changePct: number | null;
}

export interface PricePoint {
  month: string;
  pricePhpKg: number;
}

export interface AreaPrice {
  area: AreaKey;
  name: string;
  pricePhpKg: number | null;
  previousPricePhpKg: number | null;
  changePct: number | null;
}

export interface AreaPricesResponse {
  month: string;
  previousMonth: string | null;
  areas: AreaPrice[];
}

/** The six PCA reporting areas, in the order of the migration. */
export const AREAS = [
  { area: 'davao_city', name: 'Davao City', column: 'farmgate_davao_city' },
  {
    area: 'davao_de_oro',
    name: 'Davao de Oro',
    column: 'farmgate_davao_de_oro',
  },
  {
    area: 'davao_del_norte',
    name: 'Davao del Norte',
    column: 'farmgate_davao_del_norte',
  },
  {
    area: 'davao_del_sur',
    name: 'Davao del Sur',
    column: 'farmgate_davao_del_sur',
  },
  {
    area: 'davao_occidental',
    name: 'Davao Occidental',
    column: 'farmgate_davao_occidental',
  },
  {
    area: 'davao_oriental',
    name: 'Davao Oriental',
    column: 'farmgate_davao_oriental',
  },
] as const;

export type AreaKey = (typeof AREAS)[number]['area'];

const pctChange = (now: number | null, before: number | null) =>
  now != null && before != null && before !== 0
    ? round(((now - before) / before) * 100)
    : null;

@Injectable()
export class PricesService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly db: Db) {}

  /** GET /prices/latest: latest observed regional price and change from the month before. */
  async latest(): Promise<LatestPriceResponse> {
    const rows = unwrap(
      await this.db
        .from('price_history')
        .select('month, price_php_kg')
        .order('month', { ascending: false })
        .limit(2),
      'latest price',
    );
    const [latest, previous] = rows;
    if (!latest) throw new NotFoundException('No observed prices yet');
    return {
      month: latest.month,
      pricePhpKg: round(latest.price_php_kg),
      previousPricePhpKg: previous ? round(previous.price_php_kg) : null,
      // From unrounded prices, so it can differ from the rounded values by 0.01
      changePct: previous
        ? round(
            ((latest.price_php_kg - previous.price_php_kg) /
              previous.price_php_kg) *
              100,
          )
        : null,
    };
  }

  /**
   * GET /prices/areas: each area's price in the latest valid month and the
   * month before. Forecasts exist only for the regional average; these are
   * observed prices for context.
   */
  async areas(): Promise<AreaPricesResponse> {
    const rows = unwrap(
      await this.db
        .from('monthly_data')
        .select(
          'month, farmgate_davao_city, farmgate_davao_de_oro, farmgate_davao_del_norte, farmgate_davao_del_sur, farmgate_davao_occidental, farmgate_davao_oriental',
        )
        .eq('price_valid', true)
        .order('month', { ascending: false })
        .limit(2),
      'area prices',
    );
    const [latest, previous] = rows;
    if (!latest) throw new NotFoundException('No observed prices yet');
    return {
      month: latest.month,
      previousMonth: previous?.month ?? null,
      areas: AREAS.map(({ area, name, column }) => {
        const now = latest[column];
        const before = previous ? previous[column] : null;
        return {
          area,
          name,
          pricePhpKg: now == null ? null : round(now),
          previousPricePhpKg: before == null ? null : round(before),
          changePct: pctChange(now, before),
        };
      }),
    };
  }

  /** GET /prices/history: observed prices, oldest first, optionally limited to [from, to]. */
  async history(from?: string, to?: string): Promise<PricePoint[]> {
    if (from && to && from > to) {
      throw new BadRequestException('from must not be after to');
    }
    let query = this.db.from('price_history').select('month, price_php_kg');
    if (from) query = query.gte('month', from);
    if (to) query = query.lte('month', to);
    const rows = unwrap(
      await query.order('month', { ascending: true }),
      'price history',
    );
    return rows.map((r) => ({
      month: r.month,
      pricePhpKg: round(r.price_php_kg),
    }));
  }
}
