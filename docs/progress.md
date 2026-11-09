# Progress

Update this file at the end of every work session.

## Done

- [x] Repository skeleton, CLAUDE.md and docs
- [x] Supabase schema (`supabase/migrations/20261020000000_init.sql`) and seed
      data (`supabase/seed.sql`): 96 months of raw data (2018-2025), 82 feature
      rows, Chapter 4 metrics, and the thesis backtest run with 144 forecasts.
      Both files were tested on PostgreSQL 16.
- [x] `ml-service-fastapi/features.py`: feature pipeline, reproduces the thesis
      dataset (max difference 0.00014, from rounding of the exchange rate)
- [x] Colab artifacts exported to `ml-training/artifacts/` (config, models,
      results, figures); see `ml-training/README.md`
- [x] Default scaffolds for `backend-nestjs/` (NestJS) and `frontend-mobile/` (Expo 54)
- [x] 2026-10-28: `ml-service-fastapi/forecast.py`, first part: naive reference
      forecast + Markov Switching regime, `--dry-run`, `--through`, `--csv`,
      writes `model_runs` / `forecasts` / `regime_probabilities`.
      `tests/test_forecast.py` (7 tests, 10 total, all pass). Dry run with data
      through 2023-12 gives the Jan 2024 naive forecast of 26.99 PHP/kg and a
      low-volatility regime (p = 0.060). On all data (through 2025-12): Jan 2026
      naive = 60.28, p(high) = 0.491, so "low", just under the threshold.
- [x] Docs updated to the real folder names (`ml-service-fastapi/`,
      `ml-training/`, `backend-nestjs/`, `frontend-mobile/`)
- [x] 2026-10-30: FastAPI job runner (decision D9): `POST /runs`, `GET /runs`,
      `GET /runs/{jobId}`, `x-ml-key` auth, one job at a time, in-memory job
      store. `forecast.run_job` is shared by the CLI and the API.
      `tests/test_runs_api.py` (12 tests, 22 total, all pass). Smoke-tested
      with uvicorn on the fixture CSVs: dry run through 2023-12 returns 26.99.
      Contract in `docs/api.md`; fastapi/uvicorn/httpx added to requirements.
- [x] 2026-10-30: Supabase project connected. `.env` files (gitignored) in
      `ml-service-fastapi/` and `backend-nestjs/`, with generated `ML_API_KEY`
      and `ADMIN_API_KEY`. Remote data checked against the repo seed: identical
      (96 months, 8 export years, 144 backtest forecasts, naive = reference).
      Dry runs on Supabase match the CSV runs (Jan 2024 = 26.99; Jan 2026 =
      60.28, p(high) = 0.491). First live run written and verified through the
      views: run `2248a680-...` succeeded, `latest_forecasts` = naive 60.28 for
      2026-01, 82 regime rows (2019-03 to 2025-12). FastAPI dry run on
      Supabase also succeeded.
- [x] 2026-10-30: Supabase schema rebuilt from the repo (the hand-made schema
      had unbounded numerics, NOT NULL feature columns, no `annual_exports`
      year check, other constraint names). Drop + `20261020000000_init.sql` +
      `seed.sql` in one transaction; a catalog diff against the migration now
      shows no differences. RLS on all 7 tables, no policies. Live run
      `fada3840-...` written again after the seed reset (naive 60.28 for
      2026-01, 82 regime rows).
- [x] 2026-10-30: committed on branch `ml-forecast-job` (`5357cb7`).
- [x] 2026-10-30: SARIMAX, XGBoost (Full, RFE, MS-RFE) and LSTM refits in
      `forecast.py` (D4). Model setup recovered from the saved thesis models
      and documented in `docs/data-dictionary.md` ("Model setup"):
      SARIMAX on ln P with standardized exog; XGBoost on r_t, seed 42;
      `MS_Prob_t1` = lagged filtered regime probability; LSTM on 3-month
      windows of standardized RFE features with a standardized target.
      `tests/test_thesis_models.py`: the saved XGBoost (via exported `.json`)
      and SARIMAX models reproduce all 24 Chapter 4 test forecasts to within
      0.001 PHP/kg. Regime fit now starts at the first valid return (Feb 2019),
      which reproduces `markov_regimes.csv` (sd 3.605 / 13.524, stay 0.863 /
      0.925). Refit with data through 2023-12, Jan 2024 vs thesis: sarimax
      27.39 (27.39), ms_xgboost_rfe 25.73 (25.73), xgboost_full 27.36 (27.30),
      xgboost_rfe 27.37 (25.55), lstm 27.76 (27.34). On Supabase (through
      2025-12), Jan 2026: naive 60.28, sarimax 60.43, xgboost_full 58.29,
      xgboost_rfe 59.12, ms_xgboost_rfe 60.01, lstm 61.18; regime high
      (p = 0.510). 32 tests pass (about 20 s). Requirements pinned to the Colab
      major versions (statsmodels 0.15, xgboost 3.4, tensorflow 2.20, keras
      3.13); scikit-learn dropped (unused).
- [x] 2026-10-30: committed `65c24cb`; live run `9a6fa3b9-...` written with
      all six models (code_version `65c24cb`, no notes): naive 60.28
      (reference), sarimax 60.43, xgboost_full 58.29, xgboost_rfe 59.12,
      ms_xgboost_rfe 60.01, lstm 61.18 for 2026-01; 83 regime rows
      (2019-02 to 2025-12), Dec 2025 high (p = 0.5097). Bug found and fixed:
      the naive `predicted_logreturn` was stored as NaN instead of NULL
      (pandas turned None into NaN once other models added floats). Fixed in
      `forecast_rows()` with a test (33 tests pass); the one stored row was
      updated to NULL; no NaN left in `forecasts`.

- [x] 2026-11-07: NestJS foundation (branch `backend-features`):
      `@nestjs/config` 4 (the NestJS 11 line; 12 is ESM-only and breaks Jest)
      with startup validation of every env var (`src/config/env.validation.ts`,
      names missing keys, never prints values); global Supabase client with the
      service-role key (`src/supabase/supabase.module.ts`, token
      `SUPABASE_CLIENT`); `AdminKeyGuard` for `x-admin-key` (constant-time
      compare, 401); global prefix `/api/v1`; `GET /api/v1/health` reads
      `monthly_data`. Hello World scaffold removed; TypeScript `strict` on.
      11 unit tests + 1 e2e test (real Supabase, read only) pass; lint clean.
      Local `.env` files now point at the shared Supabase project
      (`zuzvkyoiqlgtgtjbzfpv`); row counts match the seed plus live runs.

- [x] 2026-11-07: ML job set up on macOS (arm64, Python 3.13 venv; default
      `python3` is 3.14, too new for TensorFlow 2.20). Needs `brew install
      libomp` for XGBoost. Fixed two bugs a fresh install exposed:
      `scikit-learn` was missing from `requirements.txt` (`XGBRegressor`
      needs it; the three XGBoost models were silently skipped), and regime
      probabilities could be 1 + 2e-16 on macOS (now clipped to [0, 1] in
      `regime_probabilities`). 33 tests pass. Dry run on Supabase: naive 60.28,
      sarimax 60.43, lstm 61.18, p(high) = 0.510 (same as the stored live run);
      XGBoost differs by machine as expected (full 59.08, rfe 59.94, ms 60.67
      vs 58.29 / 59.12 / 60.01 on Windows).

- [x] 2026-11-07: NestJS request lifecycle: `configureApp()` in
      `src/app.setup.ts` (used by `main.ts` and the e2e test): `/api/v1`
      prefix, global `ValidationPipe` (whitelist, forbid unknown fields,
      transform; `class-validator` / `class-transformer`), shutdown hooks.
      `RequestLoggerMiddleware` logs method, path, status and duration only
      (no headers, bodies or query strings). `unwrap()` in
      `src/supabase/supabase-result.ts`: use it on every Supabase query; it
      logs the real error server-side and returns a generic 500. 22 unit
      tests + 1 e2e pass; lint clean. Health check takes about 400 ms (the
      Supabase project is in eu-west-1).

- [x] 2026-11-07: all endpoints in `docs/api.md` implemented in
      `backend-nestjs/`. Typed Supabase client (`src/supabase/database.types.ts`,
      hand-written from the migration in the `supabase gen types` layout).
      Read: `GET /prices/latest`, `/prices/history`, `/forecast/latest`
      (naive reference, regime, typical error = naive RMSE for the regime from
      `model_metrics`), `/regime/history`, `/metrics`, `/backtest`. Admin
      (`AdminKeyGuard`): `POST /admin/monthly-data` (VPD computed server-side,
      same Tetens formula, matches the stored Dec 2025 value 0.928497),
      `POST /admin/annual-exports`, `POST /admin/runs` and
      `GET /admin/runs/:jobId` (forward to the FastAPI runner; 400/404/409/422
      passed through, runner auth errors -> 502, unreachable -> 503, 10 s
      timeout). Checked on Supabase: Jan 2026 naive 60.28, high (0.510),
      typical error 6.47 (53.81-66.75), 24 backtest months; a dry run started
      through NestJS reproduced Jan 2024 naive 26.99. 49 unit tests (in-memory
      fake Supabase, `src/testing/`) + 7 e2e tests (real Supabase, read only).
      `docs/api.md` now gives every response shape and error.

- [x] 2026-11-08: Expo mobile app in `frontend-mobile/` (decision D10, resolves
      O1: mobile app, no website). Expo Router (SDK 54), screens Home,
      Forecast, Result, Method from the prototypes; every number comes from the
      API (`src/api/client.ts`). Changed from the prototypes to follow the
      rules and the data: naive is the reference (prototype named
      XGBoost-MS-RFE); horizon fixed at one month; no copra grades, monthly
      high/low or local volume (not in the data); Method "Pipeline" lists all
      six compared models with their test RMSE/MAPE from `/metrics`; tech
      stack corrected (prototype said Dart/Flutter). Backend: new
      `GET /prices/areas` (area prices for the Home cards) and optional
      `CORS_ORIGINS` for the Expo web preview. Checked in Expo web against the
      real API with headless Chrome screenshots; app typecheck clean; backend
      52 unit + 8 e2e tests pass.

- [x] 2026-11-08: `POST /admin/monthly-data` verified on the real Supabase: one
      test row (2017-01-01) inserted through the API, checked (stored values,
      generated average, server-side VPD, public read, latest price and forecast
      unchanged), then deleted; 96 rows restored. Invalid requests return
      401/400 and write nothing. Insert path only; update of an existing month
      was not tried on the real data.

## Next up

1. Try the app on a real phone with Expo Go (iOS and Android); no simulator
   was available, so only the web preview has been checked.
2. GitHub Actions workflow to run `ml-service-fastapi/forecast.py` on demand and monthly.
3. Before deploying (O2): rate limiting and `helmet` on the API.

## Open issues

- Manuscript scope says "mobile-responsive web dashboard"; D10 makes it a
  mobile app. Update the manuscript (and tell the adviser).
- App: the prototype's hamburger menu, avatar ("JD"), "Share snapshot" QR and
  chart pinch-to-zoom were left out (no feature behind them yet); the chart
  supports drag-to-read instead.
- The "Results BOTTOM" prototype screenshot (10.06.08 AM) was not found; the
  Result screen was designed from the other screens.

- `/forecast/latest` does not flag a stale forecast: after new monthly data is
  entered but before the next run, `targetMonth` is already observed. The app
  can compare `dataThrough` with `/prices/latest`; or add an `isStale` field.
- `database.types.ts` is hand-written; regenerate or update it with every
  migration (`supabase gen types typescript` needs the Supabase CLI).
- Mobile QA, Android phone with Expo Go SDK 54 (2026-11-08/09; iOS untested, a physical
  iPhone needs `eas go` + TestFlight because the App Store Expo Go is SDK 58).
  Screens, values, peso sign, chart drag, refresh and the offline message passed.
  Fixed and rechecked on the phone: missing tab icons (the pill's 36pt of
  horizontal padding left no width inside the tab bar's 31pt icon slot on native;
  fixed width instead); `expo-font` pinned to SDK 54; forecast labels no longer say "next month" when the target month has
  passed, with a note explaining the data needed.
  Still open: the Home price badge is an unlabeled change over the selected range
  next to month-over-month area badges; the Forecast tab has no retry if the first
  load fails; the Result chart stays on "Loading" if the history call fails; the
  header status dot only checks on mount; the Home card has no stale-forecast
  notice; a failed pull-to-refresh on Home shows no message.
- The forecast shows January 2026 because `monthly_data` ends at December 2025.
  A forecast for a later month needs every month up to the one before it entered
  (no gaps: lags and the 12-month VPD sum need consecutive months), then a live run.
- `POST /admin/monthly-data` accepts any first-of-month date, including future
  months: a mistyped year would become the latest price everywhere.
- `npm audit --omit=dev`: backend 5 (1 critical `proxy-addr`, 3 high), all with
  fixes available; run `npm audit fix` and retest before deploying. Mobile 27,
  several only fixable by moving to a newer Expo SDK.
- A release build without `EXPO_PUBLIC_API_URL` falls back to
  `http://localhost:3000`; set an HTTPS API URL for any real build.

- Secrets (service-role key, DB password, admin and ML keys) were shared in a
  chat on 2026-11-07; rotate them and share new ones via a password manager.
- macOS setup: `python3.13 -m venv .venv`, `brew install libomp`; the venv path
  is `.venv/bin/`, not `.venv/Scripts/` (Windows).
- Live runs should come from one machine (or GitHub Actions): XGBoost refits
  differ between Mac and Windows, so the comparison forecasts would change.
- D4 (refitting trained models monthly) needs adviser confirmation.
- FastAPI runner jobs live in memory: a restart while a live job is running
  leaves its `model_runs` row in `running`. Fine at monthly cadence; mark stale
  `running` rows as `failed` if it ever happens. Run uvicorn with one worker
  (several workers would each have their own job store and lock).
- Regime label change: with the thesis sample (returns from Feb 2019) the
  Dec 2025 regime is high (p = 0.510), so the app's typical error is
  6.47 PHP/kg; the earlier fit from Mar 2019 gave low (p = 0.491). The older
  live run `fada3840-...` (naive only, old fit) is still in `model_runs` but is
  no longer the latest.
- Postgres `numeric` accepts NaN. A check constraint (new migration) could
  reject NaN in `forecasts` and `regime_probabilities` as a second safeguard.
- XGBoost refits do not reproduce the saved thesis models even on the same
  training data: deterministic per machine and thread count, but different
  from Colab (xgboost-RFE Jan 2024: 27.37 vs 25.55). Their forecasts are
  comparison only (D4); mention this when presenting D4 to the adviser.
- LSTM: the saved seed-0 model gets within 1-2 PHP/kg of the thesis LSTM test
  forecasts but not exactly; the thesis may average several seeds, or the
  scaler was fitted on a train/validation split. Check the notebook (number of
  seeds, scaler, validation split, batch size) and adjust `fit_lstm`.
- The `.joblib` XGBoost files do not unpickle with xgboost 3.4.1 on Windows;
  native `.json` exports sit next to them (`ml-training/README.md`).
- Deploying the job or the FastAPI runner must include `ml-training/` (the
  model settings are read from `ml-training/artifacts/config/summary.json`).
- Live writes through the FastAPI runner are tested with a mocked database;
  the same `write_results` path is verified on Supabase through the CLI.
- The `features` table is not written by `forecast.py`: `features.month` has a
  foreign key to `monthly_data`, so the live (not yet observed) month cannot be
  inserted. Needs a new migration if live feature rows should be stored.
- `features.py` triggers a pandas FutureWarning (`pct_change` default
  `fill_method`). Harmless now; fixing it changes behavior for gap months, so
  it falls under rule 7 (update the data dictionary and keep the tests passing).
- Python version: Colab used 3.13; `docs/architecture.md` says 3.11+. The local
  venv uses 3.13.
- Confirm the March 2019 price jump (17.62 -> 25.94 PHP/kg) with PCA.
- PAGASA station name is still "[station name]" in the manuscript.
