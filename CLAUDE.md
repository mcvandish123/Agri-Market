# Copra Price Forecasting System

Undergraduate thesis project (BS Computer Science, Ateneo de Davao University):
"Comparative Evaluation of Statistical and Machine Learning Forecasting for
Farmgate Copra Price Forecasting in the Davao Region". The research (model
comparison) is finished; this repository builds the system that delivers the
results to farmers and cooperatives.

@docs/architecture.md
@docs/progress.md

Read on demand (not loaded every session): `docs/api.md` (endpoint contract),
`docs/data-dictionary.md` (every column and feature formula).

## Repository layout

- `supabase/` - SQL migration and seed data. The schema is the source of truth.
- `ml-service-fastapi/` - Python. `features.py` (feature pipeline, verified against
  the thesis dataset) and `forecast.py` (monthly job: read Supabase, run models,
  write results). `app/` is a FastAPI job runner that starts `forecast.py` on
  request (decision D9); it never serves forecasts.
- `ml-training/` - outputs exported from the Colab training notebook:
  `artifacts/config/` (hyperparameters, RFE features, SARIMAX spec in `summary.json`),
  `artifacts/models/`, `artifacts/results/` (Chapter 4 metrics and tests),
  `artifacts/figures/`. Read-only inputs for the ML job.
- `backend-nestjs/` - NestJS REST API. Reads Supabase with the service-role key.
- `frontend-mobile/` - React Native (Expo) app. Talks only to the NestJS API.

## Commands

- ML: `cd ml-service-fastapi && .venv/Scripts/python -m pytest` |
  `python forecast.py --dry-run` | `python forecast.py --csv tests/fixtures --through 2023-12-01 --dry-run` |
  `.venv/Scripts/python -m uvicorn app.main:app --reload`
- Backend: `cd backend-nestjs && npm run start:dev` | `npm test`
- Mobile: `cd frontend-mobile && npx expo start`
- Database: apply `supabase/migrations/*.sql`, then `supabase/seed.sql`, in the Supabase SQL Editor.

## Rules that must not be broken

1. No look-ahead leakage. A forecast for month t may use only data observed by
   the end of month t-1. Never use same-month inputs as features.
2. The app's reference forecast is the naive forecast (last month's price).
   The thesis found no model significantly better (Friedman p = 0.199), so do
   not present any trained model as "more accurate" in the UI.
3. Error ranges shown to users come from `model_metrics` (naive test RMSE by
   regime: 1.30 PHP/kg calm, 6.47 PHP/kg volatile). Call them "typical error",
   never "confidence interval".
4. The mobile app never holds Supabase keys and never queries Supabase directly.
5. The Supabase service-role key lives only in server-side `.env` files and
   GitHub Actions secrets. Never commit it; never log it.
6. Every table has Row Level Security on with no policies. Do not add public
   policies or disable RLS to "make something work"; go through the API.
7. Do not change the feature formulas in `ml-service-fastapi/features.py` without
   updating `docs/data-dictionary.md` and keeping `ml-service-fastapi/tests/test_features.py` passing.
8. Schema changes go in a new file in `supabase/migrations/`; never edit an
   applied migration.

## Conventions

- Months are stored as the first day of the month (`date`, e.g. 2025-12-01).
- Prices are PHP per kg; world oil prices are USD per metric ton.
- Model names (DB and API): naive, sarimax, xgboost_full, xgboost_rfe, lstm, ms_xgboost_rfe.
- Database columns are snake_case; API JSON fields are camelCase.
- TypeScript: strict mode. Python: type hints, pandas, no notebooks in `ml-service-fastapi/`.

## Working agreement for each session

- Start by reading `docs/progress.md` and continue from "Next up".
- Work in small steps; run the relevant tests before saying a step is done.
- If a task conflicts with a rule above or a decision in `docs/architecture.md`,
  stop and ask instead of working around it.
- End every session by updating `docs/progress.md` (Done / Next up / Open issues).
