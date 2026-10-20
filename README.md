# Copra Price Forecasting System

System for the thesis "Comparative Evaluation of Statistical and Machine
Learning Forecasting for Farmgate Copra Price Forecasting in the Davao Region".

- `CLAUDE.md` - instructions Claude Code loads every session
- `docs/` - architecture and decisions, API contract, data dictionary, progress log
- `supabase/` - database schema and seed data
- `ml/` - feature pipeline and monthly forecast job (Python)
- `backend/` - NestJS API (to scaffold)
- `mobile/` - Expo app (to scaffold)

## Getting started

1. Create a Supabase project. In the SQL Editor, run
   `supabase/migrations/20261020000000_init.sql`, then `supabase/seed.sql`.
   Check: `select count(*) from monthly_data;` returns 96.
2. `cd ml && pip install -r requirements.txt && python -m pytest` (3 tests pass).
3. Initialize git: `git init && git add . && git commit -m "Project skeleton"`.
4. Open the folder in Claude Code and follow "Next up" in `docs/progress.md`.

## Suggested first Claude Code prompts

Session 1 (ML job):
> Read docs/progress.md. Write ml/forecast.py per "Next up" item 3 and
> docs/architecture.md decisions D1-D4. Start with only the naive forecast and
> the Markov Switching regime, plus --dry-run and --through. Add tests. Stop
> before adding SARIMAX, XGBoost and LSTM and show me the dry-run output for
> --through 2023-12-01.

Session 2 (backend):
> Read docs/api.md. Scaffold NestJS in backend/ as described in backend/README.md
> and implement GET /health, /prices/latest and /prices/history with tests.
> Then update docs/progress.md.

End every session with:
> Update docs/progress.md with what we did, what's next, and open issues.
