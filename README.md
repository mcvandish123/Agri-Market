# Copra Price Forecasting System

System for the thesis "Comparative Evaluation of Statistical and Machine
Learning Forecasting for Farmgate Copra Price Forecasting in the Davao Region".

- `CLAUDE.md` - instructions Claude Code loads every session
- `docs/` - architecture and decisions, API contract, data dictionary, progress log
- `supabase/` - database schema and seed data
- `ml-service-fastapi/` - feature pipeline and monthly forecast job (Python)
- `ml-training/` - artifacts exported from the Colab training notebook
- `backend-nestjs/` - NestJS API (default scaffold, endpoints to implement)
- `frontend-mobile/` - Expo app (default scaffold)

## Getting started

1. Create a Supabase project. In the SQL Editor, run
   `supabase/migrations/20261020000000_init.sql`, then `supabase/seed.sql`.
   Check: `select count(*) from monthly_data;` returns 96.
2. Set up the ML job (see `ml-service-fastapi/README.md`) and run
   `python -m pytest` in `ml-service-fastapi/` (10 tests pass).
3. Open the folder in Claude Code and follow "Next up" in `docs/progress.md`.

## Suggested Claude Code prompts

Next ML session:
> Read docs/progress.md. Add the SARIMAX, XGBoost and LSTM refits to
> ml-service-fastapi/forecast.py per decision D4, using the settings in
> ml-training/artifacts/config/. Check them against
> ml-training/artifacts/results/test_forecasts.csv.

Backend:
> Read docs/api.md. In backend-nestjs/, implement GET /health, /prices/latest
> and /prices/history with tests. Then update docs/progress.md.

End every session with:
> Update docs/progress.md with what we did, what's next, and open issues.
