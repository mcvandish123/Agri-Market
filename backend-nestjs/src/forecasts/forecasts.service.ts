import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { byModelOrder, round } from '../common/format';
import type { EvaluationSet } from '../supabase/database.types';
import type { Db } from '../supabase/supabase.module';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { dataError, unwrap, unwrapMaybe } from '../supabase/supabase-result';
import {
  BacktestResponse,
  LatestForecastResponse,
  MetricRow,
  ModelForecast,
  RegimePoint,
} from './forecasts.types';

const EVALUATION_ORDER: readonly EvaluationSet[] = [
  'cv',
  'test',
  'test_low_volatility',
  'test_high_volatility',
];

/** Probabilities keep 3 decimals so values near the 0.5 threshold stay distinct. */
const P_DIGITS = 3;

@Injectable()
export class ForecastsService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly db: Db) {}

  private async latestLiveRun() {
    const run = unwrapMaybe(
      await this.db
        .from('latest_live_run')
        .select('id, data_through, run_at')
        .maybeSingle(),
      'latest live run',
    );
    if (!run) {
      throw new NotFoundException('No live forecast run has succeeded yet');
    }
    return run;
  }

  /** GET /forecast/latest */
  async latest(): Promise<LatestForecastResponse> {
    const run = await this.latestLiveRun();
    const [forecastsRes, regimeRes, metricsRes] = await Promise.all([
      this.db
        .from('forecasts')
        .select('target_month, model_name, predicted_price, is_reference')
        .eq('run_id', run.id),
      this.db
        .from('regime_probabilities')
        .select('p_high_volatility, regime')
        .eq('run_id', run.id)
        .eq('month', run.data_through)
        .maybeSingle(),
      this.db
        .from('model_metrics')
        .select('evaluation_set, rmse')
        .eq('model_name', 'naive')
        .in('evaluation_set', ['test_low_volatility', 'test_high_volatility']),
    ]);
    const forecasts = unwrap(forecastsRes, 'latest forecasts');
    const regime = unwrapMaybe(regimeRes, 'latest regime');
    const metrics = unwrap(metricsRes, 'naive regime metrics');

    const ctx = `live run ${run.id}`;
    const reference = forecasts.find((f) => f.is_reference);
    if (!reference) dataError(ctx, 'no reference forecast');
    if (reference.model_name !== 'naive') {
      dataError(ctx, `reference is ${reference.model_name}, expected naive`);
    }
    if (!regime)
      dataError(ctx, `no regime probability for ${run.data_through}`);

    const set: EvaluationSet =
      regime.regime === 'high' ? 'test_high_volatility' : 'test_low_volatility';
    const rmse = metrics.find((m) => m.evaluation_set === set)?.rmse;
    if (rmse == null) dataError('model_metrics', `no naive ${set} RMSE`);

    const price = reference.predicted_price;
    return {
      targetMonth: reference.target_month,
      dataThrough: run.data_through,
      runAt: run.run_at,
      reference: { model: 'naive', pricePhpKg: round(price) },
      regime: {
        label: regime.regime,
        pHighVolatility: round(regime.p_high_volatility, P_DIGITS),
      },
      typicalError: {
        pricePhpKg: round(rmse),
        low: round(price - rmse),
        high: round(price + rmse),
      },
      models: forecasts
        .filter((f) => f.target_month === reference.target_month)
        .sort((a, b) => byModelOrder(a.model_name, b.model_name))
        .map((f): ModelForecast => ({
          model: f.model_name,
          pricePhpKg: round(f.predicted_price),
        })),
    };
  }

  /** GET /regime/history: filtered P(high volatility) per month from the latest live run. */
  async regimeHistory(): Promise<RegimePoint[]> {
    const run = await this.latestLiveRun();
    const rows = unwrap(
      await this.db
        .from('regime_probabilities')
        .select('month, p_high_volatility, regime')
        .eq('run_id', run.id)
        .order('month', { ascending: true }),
      'regime history',
    );
    return rows.map((r) => ({
      month: r.month,
      pHighVolatility: round(r.p_high_volatility, P_DIGITS),
      label: r.regime,
    }));
  }

  /** GET /metrics: Chapter 4 metrics, naive first. Values as stored (4 decimals). */
  async metrics(): Promise<MetricRow[]> {
    const rows = unwrap(
      await this.db.from('model_metrics').select('*'),
      'model metrics',
    );
    return rows
      .sort(
        (a, b) =>
          byModelOrder(a.model_name, b.model_name) ||
          EVALUATION_ORDER.indexOf(a.evaluation_set) -
            EVALUATION_ORDER.indexOf(b.evaluation_set),
      )
      .map((m) => ({
        model: m.model_name,
        evaluationSet: m.evaluation_set,
        rmse: m.rmse,
        rmseSd: m.rmse_sd,
        mae: m.mae,
        maeSd: m.mae_sd,
        mapePct: m.mape_pct,
        mapeSd: m.mape_sd,
        r2: m.r2,
        nMonths: m.n_months,
      }));
  }

  /** GET /backtest: thesis test period, actual price and every model's forecast per month. */
  async backtest(): Promise<BacktestResponse> {
    const run = unwrapMaybe(
      await this.db
        .from('model_runs')
        .select('id, data_through')
        .eq('run_kind', 'backtest')
        .eq('status', 'succeeded')
        .order('run_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'backtest run',
    );
    if (!run) throw new NotFoundException('No backtest run stored');

    const forecasts = unwrap(
      await this.db
        .from('forecasts')
        .select('target_month, model_name, predicted_price, is_reference')
        .eq('run_id', run.id)
        .order('target_month', { ascending: true }),
      'backtest forecasts',
    );
    if (forecasts.length === 0) {
      return {
        dataThrough: run.data_through,
        referenceModel: 'naive',
        months: [],
      };
    }
    const first = forecasts[0].target_month;
    const last = forecasts[forecasts.length - 1].target_month;
    const prices = unwrap(
      await this.db
        .from('price_history')
        .select('month, price_php_kg')
        .gte('month', first)
        .lte('month', last),
      'backtest actual prices',
    );
    const actual = new Map(prices.map((p) => [p.month, p.price_php_kg]));

    const byMonth = new Map<string, typeof forecasts>();
    for (const f of forecasts) {
      const list = byMonth.get(f.target_month) ?? [];
      list.push(f);
      byMonth.set(f.target_month, list);
    }

    return {
      dataThrough: run.data_through,
      referenceModel: 'naive',
      months: [...byMonth.entries()].map(([month, list]) => {
        const price = actual.get(month);
        return {
          month,
          actualPricePhpKg: price === undefined ? null : round(price),
          forecasts: list
            .sort((a, b) => byModelOrder(a.model_name, b.model_name))
            .map((f) => ({
              model: f.model_name,
              pricePhpKg: round(f.predicted_price),
            })),
        };
      }),
    };
  }
}
