/**
 * Types for the Supabase schema, written by hand from
 * supabase/migrations/20261020000000_init.sql (the source of truth).
 * Same layout as `supabase gen types typescript`, so it can be replaced by a
 * generated file later. Update this file whenever a migration changes a table.
 *
 * PostgREST returns `numeric` as JSON numbers and `date` / `timestamptz` as
 * ISO strings.
 */

export type ModelName =
  | 'naive'
  | 'sarimax'
  | 'xgboost_full'
  | 'xgboost_rfe'
  | 'lstm'
  | 'ms_xgboost_rfe';

export type EvaluationSet =
  'cv' | 'test' | 'test_low_volatility' | 'test_high_volatility';

export type RunKind = 'backtest' | 'live';
export type RunStatus = 'running' | 'succeeded' | 'failed';
export type RegimeLabel = 'high' | 'low';

type MonthlyDataRow = {
  month: string;
  farmgate_davao_city: number | null;
  farmgate_davao_de_oro: number | null;
  farmgate_davao_del_norte: number | null;
  farmgate_davao_del_sur: number | null;
  farmgate_davao_occidental: number | null;
  farmgate_davao_oriental: number | null;
  price_valid: boolean;
  farmgate_regional_avg: number | null; // generated
  cpi_region11: number | null;
  temp_c: number | null;
  rh_pct: number | null;
  rain_mm: number | null;
  vpd_kpa: number | null;
  coconut_oil_usd_mt: number | null;
  palm_oil_usd_mt: number | null;
  palm_kernel_oil_usd_mt: number | null;
  soybean_oil_usd_mt: number | null;
  php_usd: number | null;
  source_note: string | null;
  created_at: string;
  updated_at: string;
};

type MonthlyDataInsert = { month: string } & Partial<
  Omit<MonthlyDataRow, 'month' | 'farmgate_regional_avg'>
>;

type AnnualExportsRow = {
  year: number;
  unit_value_usd_kg: number;
  source_note: string | null;
};

type FeaturesRow = {
  month: string;
  split: 'train' | 'test' | 'live';
  target_price_phpkg: number | null;
  target_logreturn: number | null;
  price_lag1: number;
  price_lag2: number;
  price_logret_lag1: number;
  month_sin: number;
  month_cos: number;
  temp_c_t1: number | null;
  rh_pct_t1: number | null;
  rain_mm_t1: number | null;
  rain_mm_lag12: number | null;
  vpd_kpa_t1: number | null;
  vpdanom_12msum_t1: number | null;
  cpi_mom_pct_t1: number | null;
  exportuv_usdkg_prevyear: number | null;
  coconutoil_usdmt_t1: number | null;
  coconutoil_logret_t1: number | null;
  palmoil_usdmt_t1: number | null;
  palmoil_logret_t1: number | null;
  palmkerneloil_usdmt_t1: number | null;
  palmkerneloil_logret_t1: number | null;
  soybeanoil_usdmt_t1: number | null;
  soybeanoil_logret_t1: number | null;
  coconutpalm_ratio_t1: number | null;
  phpusd_t1: number | null;
  phpusd_logret_t1: number | null;
  coconutoil_phpkg_t1: number | null;
  created_at: string;
};

type ModelRunsRow = {
  id: string;
  run_kind: RunKind;
  data_through: string;
  run_at: string;
  status: RunStatus;
  code_version: string | null;
  notes: string | null;
};

type ForecastsRow = {
  id: number;
  run_id: string;
  target_month: string;
  model_name: ModelName;
  predicted_price: number;
  predicted_logreturn: number | null;
  is_reference: boolean;
};

type RegimeProbabilitiesRow = {
  run_id: string;
  month: string;
  p_high_volatility: number;
  regime: RegimeLabel; // generated: 'high' if p_high_volatility > 0.5
};

type ModelMetricsRow = {
  model_name: ModelName;
  evaluation_set: EvaluationSet;
  rmse: number | null;
  rmse_sd: number | null;
  mae: number | null;
  mae_sd: number | null;
  mape_pct: number | null;
  mape_sd: number | null;
  r2: number | null;
  n_months: number | null;
};

type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      monthly_data: Table<MonthlyDataRow, MonthlyDataInsert>;
      annual_exports: Table<
        AnnualExportsRow,
        Omit<AnnualExportsRow, 'source_note'> & { source_note?: string | null }
      >;
      features: Table<FeaturesRow>;
      model_runs: Table<ModelRunsRow>;
      forecasts: Table<ForecastsRow>;
      regime_probabilities: Table<RegimeProbabilitiesRow>;
      model_metrics: Table<ModelMetricsRow>;
    };
    Views: {
      latest_live_run: View<ModelRunsRow>;
      latest_forecasts: View<
        ForecastsRow & { data_through: string; run_at: string }
      >;
      price_history: View<{ month: string; price_php_kg: number }>;
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
