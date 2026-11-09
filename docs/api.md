# API contract (NestJS)

Base path: `/api/v1`. JSON fields are camelCase. Months are `YYYY-MM-01`.
Prices are PHP/kg rounded to 2 decimals. Errors use NestJS default shape
`{ statusCode, message, error }`.

## Public read endpoints

### GET /health
`{ "status": "ok", "database": "ok" }`. Returns 503 with
`{ "status": "error", "database": "error" }` if Supabase cannot be read.

### GET /prices/latest
Latest observed regional farmgate price and change from the previous month.
```json
{ "month": "2025-12-01", "pricePhpKg": 60.28, "previousPricePhpKg": 63.03, "changePct": -4.37 }
```
Source: view `price_history` (last two rows). `changePct` is computed from the
unrounded prices (63.033333), so it can differ by 0.01 from one computed with the
rounded values. `previousPricePhpKg` and `changePct` are `null` if only one month
is observed; 404 if none.

### GET /prices/areas
Each PCA reporting area's price in the latest valid month and the month before
(observed prices; forecasts exist only for the regional average).
```json
{
  "month": "2025-12-01",
  "previousMonth": "2025-11-01",
  "areas": [
    { "area": "davao_city", "name": "Davao City", "pricePhpKg": 60.84,
      "previousPricePhpKg": 64.06, "changePct": -5.03 }
  ]
}
```
Always six areas, in the order davao_city, davao_de_oro, davao_del_norte,
davao_del_sur, davao_occidental, davao_oriental. A missing area price is `null`
(and so is its `changePct`). Months flagged `price_valid = false` are skipped.
404 if there is no valid month. Source: `monthly_data`.

### GET /prices/history?from=2019-01-01&to=2025-12-01
```json
[ { "month": "2019-01-01", "pricePhpKg": 18.76 }, ... ]
```
`from` and `to` optional, inclusive, `YYYY-MM-01`; default is the full history.
400 if either is not a first-of-month date or `from` is after `to`.
Source: view `price_history`.

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
`models` lists every model in the run, always in the order naive, sarimax,
xgboost_full, xgboost_rfe, ms_xgboost_rfe, lstm (comparison only, rule 2).
`pHighVolatility` is rounded to 3 decimals; `label` is `high` if it is > 0.5.
Returns 404 if no live run has succeeded yet; 500 if the run has no naive
reference forecast or no regime probability for `dataThrough`.

### GET /regime/history
Filtered high-volatility probability per month from the latest live run.
`[ { "month": "2025-12-01", "pHighVolatility": 0.51, "label": "high" }, ... ]`
Oldest first, 3 decimals. 404 if no live run has succeeded yet.

### GET /metrics
Rows of `model_metrics`, for the "How accurate is this?" screen, values as stored.
Order: model (as in `/forecast/latest`), then `cv`, `test`, `test_low_volatility`,
`test_high_volatility`.
```json
[ { "model": "naive", "evaluationSet": "cv", "rmse": 2.78, "rmseSd": 2.4, "mae": 2.15,
    "maeSd": 1.86, "mapePct": 6.45, "mapeSd": 4.19, "r2": null, "nMonths": 24 }, ... ]
```

### GET /backtest
The thesis test period (Jan 2024 - Dec 2025): actual price and each model's
forecast per month, from the latest succeeded `backtest` run joined with `price_history`.
```json
{
  "dataThrough": "2023-12-01",
  "referenceModel": "naive",
  "months": [
    { "month": "2024-01-01", "actualPricePhpKg": 26.75,
      "forecasts": [ { "model": "naive", "pricePhpKg": 26.99 }, { "model": "sarimax", "pricePhpKg": 27.39 } ] }
  ]
}
```
`actualPricePhpKg` is `null` for a month without an observed price. 404 if no
backtest run is stored.

## Admin endpoints (header `x-admin-key` required)

Missing or wrong key: 401 (checked before the body is validated). Invalid body:
400 with one message per problem; unknown fields are rejected.

### POST /admin/monthly-data
Upsert one month of raw data into `monthly_data`. Body (camelCase of the table
columns): `month`, the six area prices, `cpiRegion11`, `tempC`, `rhPct`,
`rainMm`, the four oil prices, `phpUsd`, optional `sourceNote`. Validate:
`month` is a first-of-month date not after the current month (Philippine time), prices > 0, `rhPct` 0-100, `rainMm` >= 0.
`vpdKpa` is computed server-side with the Tetens equation (same formula as
`ml-service-fastapi/features.py`), rounded to 6 decimals. All fields except
`sourceNote` are required. An existing month keeps its `priceValid` flag.
Returns 200 with the stored row in camelCase (including `farmgateRegionalAvg`,
`vpdKpa`, `priceValid`, `createdAt`, `updatedAt`).

### POST /admin/annual-exports
Upsert `{ year, unitValueUsdKg, sourceNote? }` (`year` 2000-2100,
`unitValueUsdKg` > 0). Returns 200 with the stored row.

### POST /admin/runs
Body `{ dryRun?: boolean, through?: "YYYY-MM-01" }` (`dryRun` defaults to
false). Forwards to the ML runner's `POST /runs` (below) with the `x-ml-key`
header and returns 202 with its job.

### GET /admin/runs/:jobId
Forwards to the ML runner's `GET /runs/{jobId}`. `jobId` must be a UUID (400 otherwise).

Runner errors: 400, 404, 409 (a job is already running) and 422 (`through`
without `dryRun: true`) are passed through with the runner's message in the
NestJS error shape. 401/503 from the runner (key missing or mismatched) become
502; an unreachable runner or no answer within 10 s gives 503.

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
