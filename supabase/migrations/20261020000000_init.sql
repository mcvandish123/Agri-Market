-- =====================================================================
-- Copra Price Forecasting System: initial schema
-- Run in the Supabase SQL Editor (or `supabase db push`), then run seed.sql.
--
-- Access model: Row Level Security is ON for every table and NO policies
-- are defined, so the anon/authenticated keys can read nothing. Only the
-- NestJS backend and the Python ML job connect, using the service-role key,
-- which bypasses RLS. The mobile app never talks to Supabase directly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Raw monthly source data (one row per month, same-month values)
-- ---------------------------------------------------------------------
create table public.monthly_data (
  month                     date primary key
                            check (extract(day from month) = 1),
  -- Farmgate copra prices by reporting area, PHP/kg (PCA Region XI)
  farmgate_davao_city       numeric(8,2),
  farmgate_davao_de_oro     numeric(8,2),
  farmgate_davao_del_norte  numeric(8,2),
  farmgate_davao_del_sur    numeric(8,2),
  farmgate_davao_occidental numeric(8,2),
  farmgate_davao_oriental   numeric(8,2),
  -- false = price record excluded (Apr-Dec 2018 duplicate the 2019 values)
  price_valid               boolean not null default true,
  -- Regional average = mean of the six areas; NULL if any area is missing
  -- or the month's prices are flagged invalid
  farmgate_regional_avg     numeric(10,6) generated always as (
                              case when price_valid then
                                (farmgate_davao_city + farmgate_davao_de_oro
                                 + farmgate_davao_del_norte + farmgate_davao_del_sur
                                 + farmgate_davao_occidental + farmgate_davao_oriental) / 6.0
                              end
                            ) stored,
  -- Region XI CPI, 2018 = 100 (PSA)
  cpi_region11              numeric(8,2),
  -- Weather, single PAGASA station
  temp_c                    numeric(5,2),
  rh_pct                    numeric(5,2) check (rh_pct between 0 and 100),
  rain_mm                   numeric(7,2) check (rain_mm >= 0),
  vpd_kpa                   numeric(8,6),   -- Tetens equation from temp_c and rh_pct
  -- World Bank Pink Sheet, USD per metric ton
  coconut_oil_usd_mt        numeric(10,2),
  palm_oil_usd_mt           numeric(10,2),
  palm_kernel_oil_usd_mt    numeric(10,2),
  soybean_oil_usd_mt        numeric(10,2),
  -- BSP monthly average peso-dollar rate
  php_usd                   numeric(10,4),
  source_note               text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.monthly_data is
  'Raw same-month inputs. Features are built from these by ml/forecast.py using t-1 values only.';

-- ---------------------------------------------------------------------
-- 2. Annual coconut oil export unit value (PSA IMTS, Davao Region)
-- ---------------------------------------------------------------------
create table public.annual_exports (
  year               integer primary key check (year between 2000 and 2100),
  unit_value_usd_kg  numeric(12,6) not null,   -- FOB value / gross weight
  source_note        text
);

-- ---------------------------------------------------------------------
-- 3. Model-ready feature matrix (output of the feature pipeline)
--    Column names match copra_training_dataset.csv, lower-cased.
-- ---------------------------------------------------------------------
create table public.features (
  month                       date primary key references public.monthly_data(month),
  split                       text not null check (split in ('train', 'test', 'live')),
  target_price_phpkg          numeric(12,6),   -- NULL for a 'live' month not yet observed
  target_logreturn            numeric(14,8),
  price_lag1                  numeric(12,6) not null,
  price_lag2                  numeric(12,6) not null,
  price_logret_lag1           numeric(14,8) not null,
  month_sin                   numeric(10,8) not null,
  month_cos                   numeric(10,8) not null,
  temp_c_t1                   numeric(6,2),
  rh_pct_t1                   numeric(6,2),
  rain_mm_t1                  numeric(8,2),
  rain_mm_lag12               numeric(8,2),
  vpd_kpa_t1                  numeric(10,6),
  vpdanom_12msum_t1           numeric(10,6),
  cpi_mom_pct_t1              numeric(10,6),
  exportuv_usdkg_prevyear     numeric(12,6),
  coconutoil_usdmt_t1         numeric(10,2),
  coconutoil_logret_t1        numeric(14,8),
  palmoil_usdmt_t1            numeric(10,2),
  palmoil_logret_t1           numeric(14,8),
  palmkerneloil_usdmt_t1      numeric(10,2),
  palmkerneloil_logret_t1     numeric(14,8),
  soybeanoil_usdmt_t1         numeric(10,2),
  soybeanoil_logret_t1        numeric(14,8),
  coconutpalm_ratio_t1        numeric(10,6),
  phpusd_t1                   numeric(10,4),
  phpusd_logret_t1            numeric(14,8),
  coconutoil_phpkg_t1         numeric(12,6),
  created_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Model runs: one row per execution of ml/forecast.py
-- ---------------------------------------------------------------------
create table public.model_runs (
  id            uuid primary key default gen_random_uuid(),
  run_kind      text not null check (run_kind in ('backtest', 'live')),
  data_through  date not null,           -- last month of observed data used
  run_at        timestamptz not null default now(),
  status        text not null default 'running'
                check (status in ('running', 'succeeded', 'failed')),
  code_version  text,                    -- git commit SHA of the ML code
  notes         text
);

create index model_runs_latest_idx on public.model_runs (run_kind, status, run_at desc);

-- ---------------------------------------------------------------------
-- 5. Forecasts produced by a run
-- ---------------------------------------------------------------------
create table public.forecasts (
  id                   bigint generated always as identity primary key,
  run_id               uuid not null references public.model_runs(id) on delete cascade,
  target_month         date not null check (extract(day from target_month) = 1),
  model_name           text not null check (model_name in (
                         'naive', 'sarimax', 'xgboost_full', 'xgboost_rfe',
                         'lstm', 'ms_xgboost_rfe')),
  predicted_price      numeric(10,4) not null,   -- PHP/kg
  predicted_logreturn  numeric(14,8),            -- NULL for naive
  -- true for the forecast shown to users as the reference value
  -- (the naive forecast, per the thesis results)
  is_reference         boolean not null default false,
  unique (run_id, target_month, model_name)
);

create index forecasts_target_idx on public.forecasts (target_month, model_name);

-- ---------------------------------------------------------------------
-- 6. Markov Switching filtered regime probabilities
-- ---------------------------------------------------------------------
create table public.regime_probabilities (
  run_id             uuid not null references public.model_runs(id) on delete cascade,
  month              date not null,
  p_high_volatility  numeric(7,6) not null check (p_high_volatility between 0 and 1),
  regime             text generated always as (
                       case when p_high_volatility > 0.5 then 'high' else 'low' end
                     ) stored,
  primary key (run_id, month)
);

-- ---------------------------------------------------------------------
-- 7. Evaluation metrics (Chapter 4), used for error bands in the app
-- ---------------------------------------------------------------------
create table public.model_metrics (
  model_name       text not null check (model_name in (
                     'naive', 'sarimax', 'xgboost_full', 'xgboost_rfe',
                     'lstm', 'ms_xgboost_rfe')),
  evaluation_set   text not null check (evaluation_set in (
                     'cv', 'test', 'test_low_volatility', 'test_high_volatility')),
  rmse             numeric(10,4),
  rmse_sd          numeric(10,4),   -- across CV folds; NULL otherwise
  mae              numeric(10,4),
  mae_sd           numeric(10,4),
  mape_pct         numeric(10,4),
  mape_sd          numeric(10,4),
  r2               numeric(8,4),
  n_months         integer,
  primary key (model_name, evaluation_set)
);

-- ---------------------------------------------------------------------
-- 8. Convenience views (security_invoker so RLS still applies)
-- ---------------------------------------------------------------------
create view public.latest_live_run with (security_invoker = true) as
  select *
  from public.model_runs
  where run_kind = 'live' and status = 'succeeded'
  order by run_at desc
  limit 1;

create view public.latest_forecasts with (security_invoker = true) as
  select f.*, r.data_through, r.run_at
  from public.forecasts f
  join public.latest_live_run r on r.id = f.run_id;

create view public.price_history with (security_invoker = true) as
  select month, farmgate_regional_avg as price_php_kg
  from public.monthly_data
  where farmgate_regional_avg is not null
  order by month;

-- ---------------------------------------------------------------------
-- 9. updated_at trigger for monthly_data
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger monthly_data_updated_at
  before update on public.monthly_data
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. Row Level Security: on everywhere, no policies (service role only)
-- ---------------------------------------------------------------------
alter table public.monthly_data          enable row level security;
alter table public.annual_exports        enable row level security;
alter table public.features              enable row level security;
alter table public.model_runs            enable row level security;
alter table public.forecasts             enable row level security;
alter table public.regime_probabilities  enable row level security;
alter table public.model_metrics         enable row level security;
