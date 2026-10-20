# Architecture

## Data flow

```
PCA / PSA / PAGASA / World Bank / BSP
        |  (monthly, entered by an admin)
        v
POST /api/v1/admin/monthly-data  (NestJS)  --->  Supabase: monthly_data
                                                        |
                         ml/forecast.py (GitHub Actions, run monthly)
                         reads monthly_data + annual_exports
                         builds features -> runs models
                                                        |
                                                        v
                     Supabase: model_runs, forecasts, regime_probabilities
                                                        |
                                    NestJS read endpoints (GET /api/v1/...)
                                                        |
                                                        v
                                         React Native (Expo) app
```

## Components

| Component | Tech | Responsibility |
|---|---|---|
| Database | Supabase (Postgres 15+) | Raw monthly data, features, runs, forecasts, regimes, metrics |
| ML job | Python 3.11+, pandas, statsmodels, xgboost, tensorflow | Feature pipeline, monthly forecasts, regime probabilities |
| API | NestJS (TypeScript), @supabase/supabase-js | Read endpoints for the app; admin upload of monthly data |
| App | React Native with Expo | Current price, reference forecast, volatility status, history |
| Scheduler | GitHub Actions | Runs `ml/forecast.py` monthly or on demand |

## Decisions

- **D1. Forecasts are precomputed.** The forecast horizon is one month and data
  arrive monthly, so `ml/forecast.py` runs once per month and stores results.
  NestJS never runs Python or loads model files. Alternative rejected: a live
  Python inference service (more infrastructure, no benefit at monthly cadence).
- **D2. Reference forecast = naive.** Chapter 4: on the 24-month test set the
  naive forecast had the lowest error (RMSE 5.01, MAPE 6.63%) and no model was
  significantly different (Friedman p = 0.199; no pairwise DM/Wilcoxon test
  significant after Holm). The app shows the naive forecast as the reference value.
- **D3. Regime = Markov Switching filtered probability.** The two-regime model
  (switching variance) is re-estimated on all observed log returns each run;
  the latest month's filtered probability of the high-volatility regime decides
  the status shown (high if p > 0.5).
- **D4. Trained models are refit each run with fixed hyperparameters.** SARIMAX,
  XGBoost and LSTM are refit on all observed months using the hyperparameters
  chosen in the thesis (no re-tuning). Their forecasts are stored for
  transparency and comparison screens only. (Confirm with adviser.)
- **D5. Error band from thesis metrics.** Typical error = naive test RMSE in the
  current regime (1.30 PHP/kg low, 6.47 PHP/kg high), read from `model_metrics`.
- **D6. Export unit value fallback.** PSA annual trade data arrive late. If the
  previous year's export unit value is not yet available, the latest available
  year is carried forward (implemented in `ml/features.py`).
- **D7. Security.** RLS on all tables with no policies; only the service-role
  key (backend and ML job) can read or write. The app authenticates to nothing
  in Supabase. Admin endpoints require an `x-admin-key` header (secret in `.env`).
- **D8. Thesis backtest is stored.** `model_runs` has one `backtest` run
  (data through 2023-12) with the Chapter 4 test forecasts for all six models,
  so the app can show how forecasts compared with actual prices.

## Open decisions

- **O1. Web dashboard vs mobile app.** The manuscript says "mobile-responsive web
  dashboard"; the stack is React Native. Recommended: Expo with web support, so
  one codebase produces both. Otherwise update the manuscript's scope section.
- **O2. Hosting** for NestJS (e.g. Render, Railway, Fly.io).
- **O3. Who enters monthly data** and how often PCA prices become available.

## Environments and secrets

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | backend | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Server-side only |
| `SUPABASE_DB_URL` | ml | Postgres connection string (Session pooler) |
| `ADMIN_API_KEY` | backend | Required header for admin endpoints |
| `EXPO_PUBLIC_API_URL` | mobile | Base URL of the NestJS API (public, no secrets) |
