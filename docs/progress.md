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

## Next up

1. Commit the work so far (live runs record the git commit as `code_version`).
2. Add SARIMAX, XGBoost (Full, RFE, MS-RFE) and LSTM refits to `forecast.py`
   per D4, using `ml-training/artifacts/config/`. Install tensorflow then.
   Check: `--through 2023-12-01` should come close to the Jan 2024 row of
   `ml-training/artifacts/results/test_forecasts.csv`.
3. Implement the read endpoints in `docs/api.md` in `backend-nestjs/`, then
   `POST /admin/runs` and `GET /admin/runs/:jobId`, which forward to the ML runner.
4. Build the Expo app in `frontend-mobile/` (after deciding O1).
5. GitHub Actions workflow to run `ml-service-fastapi/forecast.py` on demand and monthly.

## Open issues

- O1: web dashboard vs mobile app (see `docs/architecture.md`).
- D4 (refitting trained models monthly) needs adviser confirmation.
- FastAPI runner jobs live in memory: a restart while a live job is running
  leaves its `model_runs` row in `running`. Fine at monthly cadence; mark stale
  `running` rows as `failed` if it ever happens. Run uvicorn with one worker
  (several workers would each have their own job store and lock).
- The live run `fada3840-...` records `code_version` = commit `21be1ff`, but
  the code that produced it was uncommitted at that time.
- Live writes through the FastAPI runner are tested with a mocked database;
  the same `write_results` path is verified on Supabase through the CLI.
- Markov Switching on the training period gives sd 3.60% / 13.69%, stay prob.
  0.861 / 0.922. Thesis (`markov_regimes.csv`): 3.61% / 13.52%, 0.863 / 0.925.
  Close but not identical; check the notebook's exact settings and the
  statsmodels version (Colab 0.15).
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
