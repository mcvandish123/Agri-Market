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

## Next up

1. Commit, then write a live run with all six models to Supabase (so its
   `code_version` matches the code).
2. Implement the read endpoints in `docs/api.md` in `backend-nestjs/`, then
   `POST /admin/runs` and `GET /admin/runs/:jobId`, which forward to the ML runner.
3. Build the Expo app in `frontend-mobile/` (after deciding O1).
4. GitHub Actions workflow to run `ml-service-fastapi/forecast.py` on demand and monthly.

## Open issues

- O1: web dashboard vs mobile app (see `docs/architecture.md`).
- D4 (refitting trained models monthly) needs adviser confirmation.
- FastAPI runner jobs live in memory: a restart while a live job is running
  leaves its `model_runs` row in `running`. Fine at monthly cadence; mark stale
  `running` rows as `failed` if it ever happens. Run uvicorn with one worker
  (several workers would each have their own job store and lock).
- Regime label change: with the thesis sample (returns from Feb 2019) the
  Dec 2025 regime is high (p = 0.510); the earlier fit from Mar 2019 gave low
  (p = 0.491). Live run `fada3840-...` in Supabase still has the old fit and
  naive only, until the next live run.
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
