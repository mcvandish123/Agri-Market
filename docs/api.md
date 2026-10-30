# API contract (NestJS)

Base path: `/api/v1`. JSON fields are camelCase. Months are `YYYY-MM-01`.
Prices are PHP/kg rounded to 2 decimals. Errors use NestJS default shape
`{ statusCode, message, error }`.

## Public read endpoints

### GET /health
`{ "status": "ok", "database": "ok" }`

### GET /prices/latest
Latest observed regional farmgate price and change from the previous month.
```json
{ "month": "2025-12-01", "pricePhpKg": 60.28, "previousPricePhpKg": 63.03, "changePct": -4.36 }
```
Source: view `price_history` (last two rows).

### GET /prices/history?from=2019-01-01&to=2025-12-01
```json
[ { "month": "2019-01-01", "pricePhpKg": 18.76 }, ... ]
```
`from` and `to` optional; default is the full history. Source: view `price_history`.

### GET /forecast/latest
The forecast for the month after the latest observed month, from the latest
succeeded `live` run.
```json
{
  "targetMonth": "2026-01-01",
  "dataThrough": "2025-12-01",
  "runAt": "2026-01-08T02:00:00Z",
  "reference": { "model": "naive", "pricePhpKg": 60.28 },
  "regime": { "label": "high", "pHighVolatility": 0.83 },
  "typicalError": { "pricePhpKg": 6.47, "low": 53.81, "high": 66.75 },
  "models": [
    { "model": "naive", "pricePhpKg": 60.28 },
    { "model": "sarimax", "pricePhpKg": 59.90 }
  ]
}
```
Rules: `reference` is the row with `is_reference = true`. `typicalError` is the
naive RMSE for the current regime from `model_metrics`
(`test_low_volatility` or `test_high_volatility`); `low`/`high` are reference ± that value.
Returns 404 if no live run has succeeded yet.

### GET /regime/history
Filtered high-volatility probability per month from the latest live run.
`[ { "month": "2025-12-01", "pHighVolatility": 0.83, "label": "high" }, ... ]`

### GET /metrics
Rows of `model_metrics`, for the "How accurate is this?" screen.

### GET /backtest
The thesis test period (Jan 2024 - Dec 2025): actual price and each model's
forecast per month, from the `backtest` run joined with `price_history`.

## Admin endpoints (header `x-admin-key` required)

### POST /admin/monthly-data
Upsert one month of raw data into `monthly_data`. Body (camelCase of the table
columns): `month`, the six area prices, `cpiRegion11`, `tempC`, `rhPct`,
`rainMm`, the four oil prices, `phpUsd`, optional `sourceNote`. Validate:
`month` is a first-of-month date, prices > 0, `rhPct` 0-100, `rainMm` >= 0.
`vpdKpa` is computed server-side with the Tetens equation (same formula as
`ml-service-fastapi/features.py`). Returns the stored row.

### POST /admin/annual-exports
Upsert `{ year, unitValueUsdKg, sourceNote? }`.

### POST /admin/runs (later)
Body `{ dryRun?: boolean, through?: "YYYY-MM-01" }`. Forwards to the ML runner's
`POST /runs` (below) with the `x-ml-key` header and returns its job.

### GET /admin/runs/:jobId (later)
Forwards to the ML runner's `GET /runs/{jobId}`.

# ML job runner contract (FastAPI, decision D9)

Called only by NestJS, never by the app. Base URL `ML_SERVICE_URL`; every route
except `/health` needs the header `x-ml-key: <ML_API_KEY>`. Interactive docs at
`/docs`. Source: `ml-service-fastapi/app/`.

| Route | Result |
|---|---|
| `GET /health` | `{ "status": "ok" }` (no key needed) |
| `POST /runs` | 202 + job. Body `{ "dryRun": false, "through": null }`. 409 if a job is already queued/running; 422 if `through` is not a first-of-month date or is used without `dryRun: true`; 400 if `ML_CSV_DIR` is set and `dryRun` is false |
| `GET /runs` | The last 50 jobs, newest first (in memory, cleared on restart) |
| `GET /runs/{jobId}` | One job; 404 if unknown |

Missing or wrong key: 401. `ML_API_KEY` not configured: 503.

Job:
```json
{
  "jobId": "f2a1b91a-...",
  "status": "succeeded",
  "dryRun": true,
  "through": "2023-12-01",
  "createdAt": "2026-10-30T01:52:29.447960Z",
  "finishedAt": "2026-10-30T01:52:29.673281Z",
  "modelRunId": null,
  "error": null,
  "result": {
    "dataThrough": "2023-12-01",
    "targetMonth": "2024-01-01",
    "forecasts": [ { "model": "naive", "pricePhpKg": 26.99, "isReference": true } ],
    "regime": { "month": "2023-12-01", "pHighVolatility": 0.06, "label": "low" }
  }
}
```
`status` is `queued`, `running`, `succeeded` or `failed` (then `error` is set).
`modelRunId` is the `model_runs.id` written by a live run, `null` for dry runs.
Poll `GET /runs/{jobId}` until `succeeded` or `failed`.
