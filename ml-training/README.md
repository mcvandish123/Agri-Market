# ML training artifacts

Outputs exported from the Google Colab training notebook (thesis Chapter 4).
The research is finished, so these files are read-only inputs for the monthly
job in `ml-service-fastapi/forecast.py`. Do not retrain or re-tune here.

## artifacts/config/ - settings the monthly job refits with (decision D4)

| File | Contents |
|---|---|
| `summary.json` | Library versions used in Colab, train/test sizes (58/24 months), the 24 RFE-selected features, SARIMAX order (0,1,0) + seasonal (0,0,0,12) and its 5 exogenous features, LSTM and XGBoost hyperparameters, Friedman test, test metrics |
| `xgb_best_params.json` | Optuna-tuned hyperparameters for XGBoost-Full, XGBoost-RFE, MS-XGBoost-RFE |
| `lstm_best_params.json` | LSTM hyperparameters (units, layers, dropout, lookback `L`, learning rate, epochs) |
| `rfe_ranking.csv` | RFE rank for all 25 features (only `CoconutOil_USDmt_t1` dropped) |
| `sarimax_top10.csv` | Ten lowest-AIC SARIMAX orders |
| `markov_regimes.csv` | Two-regime Markov Switching estimates on the training period |

## artifacts/models/

Fitted models from the training period: `model_SARIMAX.pkl`,
`model_XGBoost-Full.joblib`, `model_XGBoost-RFE.joblib`,
`model_MS-XGBoost-RFE.joblib`, `model_LSTM_seed0.keras`. Per D4 the monthly job
refits on all observed months, so these are kept for reference and checks only.

## artifacts/results/ - Chapter 4 results

`test_metrics.csv`, `metrics_by_regime.csv`, `test_forecasts.csv` (24 test
months, all six models), `pairwise_tests.csv` (DM and Wilcoxon, Holm-adjusted),
`nemenyi_pvalues.csv`, `feature_importance.csv`, `dashboard_forecasts.json`.
These are already loaded into Supabase by `supabase/seed.sql`
(`model_metrics` and the `backtest` run).

## artifacts/figures/

Thesis figures (price series, Markov regimes, RFE CV curve, feature importance,
test forecasts).

## Library versions

Colab used Python 3.13, numpy 2.1, pandas 2.2, scikit-learn 1.6, statsmodels
0.15, xgboost 3.4, tensorflow 2.20 (`summary.json`). Keep
`ml-service-fastapi/requirements.txt` on the same major versions.

`index.py` is currently empty.
