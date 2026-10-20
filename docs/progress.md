# Progress

Update this file at the end of every work session.

## Done

- [x] Repository skeleton, CLAUDE.md and docs
- [x] Supabase schema (`supabase/migrations/20261020000000_init.sql`) and seed
      data (`supabase/seed.sql`): 96 months of raw data (2018-2025), 82 feature
      rows, Chapter 4 metrics, and the thesis backtest run with 144 forecasts.
      Both files were tested on PostgreSQL 16.
- [x] `ml/features.py`: feature pipeline, reproduces the thesis dataset (max
      difference 0.00014, from rounding of the exchange rate)

## Next up

1. Create the Supabase project; run the migration, then the seed (SQL Editor).
2. Export trained artifacts and tuned hyperparameters from Colab into `ml/artifacts/`
   (see `ml/README.md`).
3. Write `ml/forecast.py`: read `monthly_data` and `annual_exports`, build
   features, run naive + Markov Switching (+ refit SARIMAX/XGBoost/LSTM per D4),
   write `model_runs`, `forecasts`, `regime_probabilities`. Add `--dry-run`.
   First test: run it with data through 2023-12 and check the January 2024
   naive forecast equals 26.99 PHP/kg.
4. Scaffold NestJS in `backend/` and implement the read endpoints in `docs/api.md`.
5. Scaffold the Expo app in `mobile/` (after deciding O1).
6. GitHub Actions workflow to run `ml/forecast.py` on demand and monthly.

## Open issues

- O1: web dashboard vs mobile app (see `docs/architecture.md`).
- D4 (refitting trained models monthly) needs adviser confirmation.
- Confirm the March 2019 price jump (17.62 -> 25.94 PHP/kg) with PCA.
- PAGASA station name is still "[station name]" in the manuscript.
