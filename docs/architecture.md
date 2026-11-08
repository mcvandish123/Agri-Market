# Architecture

## Data flow

```
PCA / PSA / PAGASA / World Bank / BSP
        |  (monthly, entered by an admin)
        v
POST /api/v1/admin/monthly-data  (NestJS)  --->  Supabase: monthly_data
                                                        |
            ml-service-fastapi/forecast.py
              monthly: GitHub Actions runs the CLI
              on demand: NestJS POST /admin/runs -> FastAPI POST /runs (D9)
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
| ML job | Python 3.11-3.13 (TensorFlow 2.20 has no 3.14 build), pandas, statsmodels, xgboost, tensorflow | Feature pipeline, monthly forecasts, regime probabilities |
| API | NestJS (TypeScript), @supabase/supabase-js | Read endpoints for the app; admin upload of monthly data |
| App | React Native with Expo | Current price, reference forecast, volatility status, history |
| ML job runner | FastAPI (`ml-service-fastapi/app/`) | Starts `forecast.py` on request and reports job status (D9) |
| Scheduler | GitHub Actions | Runs `ml-service-fastapi/forecast.py` monthly |

## Decisions

- **D1. Forecasts are precomputed.** The forecast horizon is one month and data
  arrive monthly, so `ml-service-fastapi/forecast.py` runs once per month and stores results.
  NestJS never runs Python or loads model files. Alternative rejected: a live
  Python inference service (more infrastructure, no benefit at monthly cadence).
- **D2. Reference forecast = naive.** Chapter 4: on the 24-month test set the
  naive forecast had the lowest error (RMSE 5.01, MAPE 6.63%) and no model was
  significantly different (Friedman p = 0.199; no pairwise DM/Wilcoxon test
  significant after Holm). The app shows the naive forecast as the reference value.
- **D3. Regime = Markov Switching filtered probability.** The two-regime model
  (switching variance) is re-estimated on all observed log returns each run;
  the latest month's filtered probability of the high-volatility regime decides
  the status shown (high if p > 0.5). Implementation: statsmodels
  `MarkovRegression(k_regimes=2, switching_variance=True)` (mean also switches)
  on log returns in percent, starting at the first valid return (Feb 2019, as in
  the thesis); "high" is the regime with the larger variance. Each run stores
  the filtered probability for every observed month.
- **D4. Trained models are refit each run with fixed hyperparameters.** SARIMAX,
  XGBoost and LSTM are refit on all observed months using the hyperparameters
  chosen in the thesis (no re-tuning). Their forecasts are stored for
  transparency and comparison screens only. (Confirm with adviser.)
  Model setup per model: `docs/data-dictionary.md`, "Model setup". A refit on
  the thesis training period reproduces SARIMAX exactly; XGBoost and LSTM refits
  differ from the saved thesis models (random number generation differs between
  machines and library builds), so their monthly forecasts are not the thesis
  models' forecasts. If a trained model fails, it is skipped and named in
  `model_runs.notes`; the run still succeeds, because only the naive reference
  is required.
- **D5. Error band from thesis metrics.** Typical error = naive test RMSE in the
  current regime (1.30 PHP/kg low, 6.47 PHP/kg high), read from `model_metrics`.
- **D6. Export unit value fallback.** PSA annual trade data arrive late. If the
  previous year's export unit value is not yet available, the latest available
  year is carried forward (implemented in `ml-service-fastapi/features.py`).
- **D7. Security.** RLS on all tables with no policies; only the service-role
  key (backend and ML job) can read or write. The app authenticates to nothing
  in Supabase. Admin endpoints require an `x-admin-key` header (secret in `.env`).
- **D8. Thesis backtest is stored.** `model_runs` has one `backtest` run
  (data through 2023-12) with the Chapter 4 test forecasts for all six models,
  so the app can show how forecasts compared with actual prices.
- **D9. FastAPI is a job runner, not an inference service** (2026-10-30). The
  FastAPI app in `ml-service-fastapi/app/` only starts `forecast.run_job` (the
  same code the CLI runs) and reports its status: `POST /runs`, `GET /runs`,
  `GET /runs/{jobId}`, `GET /health`. It never serves forecasts; those are
  still precomputed and read from Supabase by NestJS (D1 unchanged). NestJS
  calls it with the `x-ml-key` header. Jobs are tracked in memory, one at a
  time; the durable record is the `model_runs` row. Replays (`through`) are
  dry runs only, so they can never become the latest live run.

- **D10. Mobile app, one-month regional forecast** (2026-11-08, resolves O1).
  The client is the Expo (React Native) app in `frontend-mobile/`; the web
  dashboard is dropped for now (update the manuscript's "mobile-responsive web
  dashboard" scope). The app shows the one-month-ahead forecast for the Davao
  Region average only, as evaluated in the thesis: no multi-month horizon, no
  per-area forecasts, no copra grades (not in the data). Area prices from
  `GET /prices/areas` are shown as observed context. Expo web is used only to
  preview during development.

## Open decisions

- **O2. Hosting** for NestJS and the FastAPI runner (e.g. Render, Railway, Fly.io).
  The runner needs enough memory for the TensorFlow LSTM refit.
- **O3. Who enters monthly data** and how often PCA prices become available.

## Environments and secrets

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | backend | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Server-side only |
| `SUPABASE_DB_URL` | ml | Postgres connection string (Session pooler) |
| `ML_API_KEY` | ml (FastAPI), backend | Shared secret for the `x-ml-key` header; server-side only |
| `ML_SERVICE_URL` | backend | Base URL of the FastAPI runner |
| `ML_CSV_DIR` | ml (FastAPI), optional | Local development: read fixture CSVs instead of Supabase (dry runs only) |
| `ADMIN_API_KEY` | backend | Required header for admin endpoints |
| `PORT` | backend, optional | HTTP port for NestJS (default 3000) |
| `CORS_ORIGINS` | backend, optional | Comma-separated browser origins for the Expo web preview; CORS is off when unset (the phone app does not need it) |
| `EXPO_PUBLIC_API_URL` | mobile, optional | Base URL of the NestJS API including `/api/v1` (public, no secrets). Unset in development: the dev server's computer on port 3000 |
