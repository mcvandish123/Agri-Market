/** Small slices of the real seed data (supabase/seed.sql and the live run). */

export const LIVE_RUN = '9a6fa3b9-494e-46d6-b83a-048a79ee9fc2';
export const BACKTEST_RUN = '00000000-0000-4000-8000-000000002024';

export const priceHistory = [
  { month: '2025-10-01', price_php_kg: 62.905 },
  { month: '2025-11-01', price_php_kg: 63.033333 },
  { month: '2025-12-01', price_php_kg: 60.28 },
  { month: '2024-01-01', price_php_kg: 26.75 },
];

export const latestLiveRun = [
  {
    id: LIVE_RUN,
    data_through: '2025-12-01',
    run_at: '2026-10-30T10:59:50+00:00',
  },
];

export const modelRuns = [
  {
    id: BACKTEST_RUN,
    run_kind: 'backtest',
    status: 'succeeded',
    data_through: '2023-12-01',
    run_at: '2026-09-01T00:00:00+00:00',
  },
  {
    id: LIVE_RUN,
    run_kind: 'live',
    status: 'succeeded',
    data_through: '2025-12-01',
    run_at: '2026-10-30T10:59:50+00:00',
  },
];

const live = (
  model_name: string,
  predicted_price: number,
  is_reference = false,
) => ({
  run_id: LIVE_RUN,
  target_month: '2026-01-01',
  model_name,
  predicted_price,
  is_reference,
});
const bt = (
  target_month: string,
  model_name: string,
  predicted_price: number,
) => ({
  run_id: BACKTEST_RUN,
  target_month,
  model_name,
  predicted_price,
  is_reference: model_name === 'naive',
});

// Deliberately not in display order, to test sorting
export const forecasts = [
  live('lstm', 61.1818),
  live('sarimax', 60.4298),
  live('naive', 60.28, true),
  live('ms_xgboost_rfe', 60.0147),
  live('xgboost_full', 58.2948),
  live('xgboost_rfe', 59.1213),
  bt('2024-02-01', 'naive', 26.75),
  bt('2024-01-01', 'sarimax', 27.3864),
  bt('2024-01-01', 'naive', 26.9867),
];

export const regimeProbabilities = [
  {
    run_id: LIVE_RUN,
    month: '2025-12-01',
    p_high_volatility: 0.509693,
    regime: 'high',
  },
  {
    run_id: LIVE_RUN,
    month: '2025-11-01',
    p_high_volatility: 0.502951,
    regime: 'high',
  },
  {
    run_id: 'other-run',
    month: '2025-12-01',
    p_high_volatility: 0.49,
    regime: 'low',
  },
];

const metric = (model_name: string, evaluation_set: string, rmse: number) => ({
  model_name,
  evaluation_set,
  rmse,
  rmse_sd: null,
  mae: null,
  mae_sd: null,
  mape_pct: null,
  mape_sd: null,
  r2: null,
  n_months: null,
});

export const modelMetrics = [
  metric('sarimax', 'test', 5.3),
  metric('naive', 'test_high_volatility', 6.472),
  metric('naive', 'test', 5.014),
  metric('naive', 'test_low_volatility', 1.297),
  metric('naive', 'cv', 2.78),
];

export const tables = () => ({
  price_history: priceHistory,
  latest_live_run: latestLiveRun,
  model_runs: modelRuns,
  forecasts,
  regime_probabilities: regimeProbabilities,
  model_metrics: modelMetrics,
});
