# ML Service

Feature pipeline (`features.py`), the monthly forecast job (`forecast.py`), and
a FastAPI job runner (`app/`) that starts the job on request (decision D9).

## Setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows (Git Bash): source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env             # then paste the Supabase Session pooler connection string
python -m pytest                 # 22 tests; the feature pipeline must reproduce the thesis dataset
```

## forecast.py

```bash
python forecast.py                                  # live run: forecast the month after the latest data, write to Supabase
python forecast.py --dry-run                        # compute and print, write nothing
python forecast.py --through 2023-12-01 --dry-run   # replay: data through Dec 2023 -> Jan 2024 forecast (26.99)
python forecast.py --csv tests/fixtures --dry-run   # read the fixture CSVs instead of Supabase
```

`--through` and `--csv` work only with `--dry-run`, so a replay can never be
written as the latest live run.

A live run inserts one `model_runs` row (`run_kind = 'live'`), the naive
forecast (`is_reference = true`) into `forecasts`, and the filtered
high-volatility probability for every observed month into
`regime_probabilities`. If an insert fails, the run is marked `failed`.

Not added yet: SARIMAX, XGBoost and LSTM refits (decision D4).

## FastAPI job runner

Runs the same `forecast.run_job` as the CLI; it never serves forecasts itself
(NestJS reads those from Supabase). Contract: `docs/api.md`, "ML job runner contract".

```bash
uvicorn app.main:app --reload    # needs ML_API_KEY in .env
```

Without Supabase, set `ML_CSV_DIR=tests/fixtures` in `.env` to dry-run on the fixtures:

```bash
curl -X POST localhost:8000/runs -H "x-ml-key: $ML_API_KEY" \
     -H "content-type: application/json" -d '{"dryRun": true, "through": "2023-12-01"}'
curl localhost:8000/runs/<jobId> -H "x-ml-key: $ML_API_KEY"
```

Open http://127.0.0.1:8000/docs for the interactive API documentation.

| Path | Role |
|---|---|
| `app/main.py` | App and routers |
| `app/routers/runs.py` | `POST /runs`, `GET /runs`, `GET /runs/{jobId}` |
| `app/services/runs.py` | In-memory job store, one job at a time, calls `forecast.run_job` |
| `app/schemas.py` | Request/response models (camelCase JSON) |
| `app/auth.py` | `x-ml-key` check |
| `app/config.py` | `ML_API_KEY`, `ML_CSV_DIR` from `.env` |
