# Mobile app (React Native, Expo)

Not scaffolded yet; decide open decision O1 (web dashboard vs mobile) first.
Expo can build Android, iOS and web from one codebase.

```bash
npx create-expo-app@latest mobile
```

The app reads only from the NestJS API (`EXPO_PUBLIC_API_URL`). Planned screens:
1. Home: latest price, next month's reference forecast, volatility status, typical error range.
2. History: price chart since 2019 with high-volatility months shaded.
3. Accuracy: thesis backtest (forecast vs actual, 2024-2025) and model metrics.
4. About: data sources, update date, and a plain-language note that forecasts are a reference, not a guarantee.
