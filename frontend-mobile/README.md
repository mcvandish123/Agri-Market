# Agri-Copra mobile app (React Native, Expo SDK 54)

The farmer-facing app (decision D10 in `docs/architecture.md`). It reads only
from the NestJS API, never from Supabase (CLAUDE.md rule 4).

## Run it

1. Start the API: `cd ../backend-nestjs && npm run start:dev` (port 3000).
2. Start the app: `npx expo start`, then scan the QR code with Expo Go
   (phone on the same Wi-Fi as your computer), or press `w` for a web preview.

The API address is found automatically in development: the computer running
`expo start`, port 3000. To use another API, copy `.env.example` to `.env` and
set `EXPO_PUBLIC_API_URL` (it is public, so never put a secret in it).

Web preview only: the browser needs CORS, so start the API with
`CORS_ORIGINS=http://localhost:8081` (in `backend-nestjs/.env` or the shell).
The phone app does not need it.

Checks: `npm run typecheck`.

## Screens (`src/app/`, Expo Router)

| Screen | File | API calls |
|---|---|---|
| Home: regional price, chart (3M/6M/1Y/5Y/All), next-month teaser, area prices | `(tabs)/index.tsx` | `/prices/latest`, `/prices/history`, `/prices/areas`, `/forecast/latest` |
| Forecast: area (optional) and horizon (fixed at 1 month) | `(tabs)/forecast.tsx` | `/prices/areas`, `/forecast/latest` |
| Result: naive reference, typical error, volatility, area comparison, chart, all six models | `result.tsx` | `/forecast/latest`, `/prices/latest`, `/prices/areas`, `/prices/history` |
| Method: introduction, the six compared models with test error, regimes, sources, stack | `(tabs)/method.tsx` | `/metrics` |
| Header status dot | `components/AppHeader.tsx` | `/health` |

All calls are in `src/api/client.ts`; response types in `src/api/types.ts`.

## Rules the UI follows

- The reference forecast is always the naive forecast; other models are
  "comparison only", in a fixed order, never ranked (rule 2).
- The range is called "typical error" and comes from the API (naive test RMSE
  for the current regime), never "confidence interval" (rule 3).
- Forecasts are one month ahead for the Davao Region average. Area prices are
  observed prices for context; there is no per-area or multi-month forecast and
  no copra grade data.
