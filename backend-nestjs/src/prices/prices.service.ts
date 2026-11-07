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
