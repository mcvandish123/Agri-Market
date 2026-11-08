/** Response shapes of the NestJS API (docs/api.md). Months are `YYYY-MM-01`. */

export type ModelName =
  | 'naive'
  | 'sarimax'
  | 'xgboost_full'
  | 'xgboost_rfe'
  | 'ms_xgboost_rfe'
  | 'lstm';

export type RegimeLabel = 'high' | 'low';

export interface LatestPrice {
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
  area: string;
  name: string;
  pricePhpKg: number | null;
  previousPricePhpKg: number | null;
  changePct: number | null;
}

export interface AreaPrices {
  month: string;
  previousMonth: string | null;
  areas: AreaPrice[];
}

export interface ModelForecast {
  model: ModelName;
  pricePhpKg: number;
}

export interface LatestForecast {
  targetMonth: string;
  dataThrough: string;
  runAt: string;
  reference: ModelForecast;
  regime: { label: RegimeLabel; pHighVolatility: number };
  typicalError: { pricePhpKg: number; low: number; high: number };
  models: ModelForecast[];
}

export interface MetricRow {
  model: ModelName;
  evaluationSet: 'cv' | 'test' | 'test_low_volatility' | 'test_high_volatility';
  rmse: number | null;
  rmseSd: number | null;
  mae: number | null;
  maeSd: number | null;
  mapePct: number | null;
  mapeSd: number | null;
  r2: number | null;
  nMonths: number | null;
}

export interface Health {
  status: 'ok';
  database: 'ok';
}
