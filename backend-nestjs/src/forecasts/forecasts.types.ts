import type {
  EvaluationSet,
  ModelName,
  RegimeLabel,
} from '../supabase/database.types';

export interface ModelForecast {
  model: ModelName;
  pricePhpKg: number;
}

export interface LatestForecastResponse {
  targetMonth: string;
  dataThrough: string;
  runAt: string;
  /** Always the naive forecast (CLAUDE.md rule 2, decision D2). */
  reference: ModelForecast;
  regime: { label: RegimeLabel; pHighVolatility: number };
  /** Naive test RMSE in the current regime (rule 3, D5). Not a confidence interval. */
  typicalError: { pricePhpKg: number; low: number; high: number };
  /** Every model's forecast, naive first. For comparison only. */
  models: ModelForecast[];
}

export interface RegimePoint {
  month: string;
  pHighVolatility: number;
  label: RegimeLabel;
}

export interface MetricRow {
  model: ModelName;
  evaluationSet: EvaluationSet;
  rmse: number | null;
  rmseSd: number | null;
  mae: number | null;
  maeSd: number | null;
  mapePct: number | null;
  mapeSd: number | null;
  r2: number | null;
  nMonths: number | null;
}

export interface BacktestMonth {
  month: string;
  /** null if the actual price for that month is not available */
  actualPricePhpKg: number | null;
  forecasts: ModelForecast[];
}

export interface BacktestResponse {
  dataThrough: string;
  referenceModel: ModelName;
  months: BacktestMonth[];
}
