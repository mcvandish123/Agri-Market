# Data dictionary

## Sources

| Data | Source | Frequency | Table column(s) |
|---|---|---|---|
| Farmgate copra price, six reporting areas (PHP/kg) | PCA Region XI | Monthly | `monthly_data.farmgate_*` |
| Consumer price index, Region XI (2018 = 100) | PSA | Monthly | `monthly_data.cpi_region11` |
| Mean temperature, relative humidity, total rainfall | PAGASA (single station) | Monthly | `temp_c`, `rh_pct`, `rain_mm` |
| Coconut, palm, palm kernel, soybean oil (USD/mt) | World Bank Pink Sheet | Monthly | `*_oil_usd_mt` |
| Peso-dollar rate, monthly average | BSP | Monthly | `php_usd` |
| Coconut oil export FOB value / gross weight (USD/kg) | PSA IMTS, Davao Region | Annual | `annual_exports.unit_value_usd_kg` |

Data notes:
- 2018 farmgate prices are excluded (`price_valid = false`): Apr-Dec 2018 repeat
  the 2019 values in the source records. Other 2018 inputs are kept because the
  lagged features of early 2019 need them.
- Millgate prices are not used (reported only for 2021 and 2023-2025).
- World Bank changed several vegetable oil series definitions in 2021, Nov 2024
  and Jan 2025 (see the Pink Sheet "Description" tab).

## Target

| Column | Formula |
|---|---|
| `Target_Price_PHPkg` | P_t = mean of the six area prices in month t |
| `Target_LogReturn` | r_t = ln P_t - ln P_(t-1). ML models predict r_t; price forecast = P_(t-1) * exp(r_hat_t) |

## Features (25), all known by the end of month t-1

| Feature | Formula / meaning | Source |
|---|---|---|
| `Price_Lag1`, `Price_Lag2` | P_(t-1), P_(t-2) | PCA |
| `Price_LogRet_Lag1` | r_(t-1) | computed |
| `Month_sin`, `Month_cos` | sin(2*pi*m/12), cos(2*pi*m/12), m = calendar month of t | computed |
| `Temp_C_t1`, `RH_pct_t1`, `Rain_mm_t1` | previous month's weather | PAGASA |
| `Rain_mm_Lag12` | rainfall in month t-12 | PAGASA |
| `VPD_kPa_t1` | VPD_(t-1), VPD = 0.61078 * exp(17.27*T/(T+237.3)) * (1 - RH/100) | computed |
| `VPDanom_12mSum_t1` | sum of (VPD - baseline for that calendar month) over months t-12 .. t-1; baseline = 2015-2018 monthly means (constants in `ml-service-fastapi/features.py`) | computed |
| `CPI_MoM_pct_t1` | percent change of CPI from t-2 to t-1 | PSA |
| `ExportUV_USDkg_prevYear` | export unit value of the previous calendar year (latest available year if not yet published) | PSA IMTS |
| `<Oil>_USDmt_t1` | previous month's world price, for CoconutOil, PalmOil, PalmKernelOil, SoybeanOil | World Bank |
| `<Oil>_LogRet_t1` | ln price_(t-1) - ln price_(t-2) | computed |
| `CoconutPalm_Ratio_t1` | coconut oil / palm oil price, month t-1 | computed |
| `PHPUSD_t1`, `PHPUSD_LogRet_t1` | previous month's rate and its log change | BSP |
| `CoconutOil_PHPkg_t1` | coconut oil USD/mt * PHP/USD / 1000, month t-1 | computed |

Feature columns in the `features` table are the same names in lower case.
`ml-service-fastapi/tests/test_features.py` checks that `ml-service-fastapi/features.py` reproduces the thesis
dataset (`ml-service-fastapi/tests/fixtures/copra_training_dataset.csv`) to within 0.001.

## Thesis split

- Training: March 2019 - December 2023 (58 months)
- Test: January 2024 - December 2025 (24 months)
- Live rows (`split = 'live'`): months after December 2025.

## Thesis results used by the system (Chapter 4)

| Model | Test RMSE | Test MAPE (%) | RMSE low-volatility | RMSE high-volatility |
|---|---|---|---|---|
| naive | 5.01 | 6.63 | 1.30 | 6.47 |
| ms_xgboost_rfe | 5.55 | 7.39 | 1.48 | 7.16 |
| xgboost_rfe | 5.56 | 7.79 | 1.39 | 7.18 |
| sarimax | 5.65 | 7.59 | 1.74 | 7.26 |
| xgboost_full | 6.01 | 8.31 | 1.54 | 7.76 |
| lstm | 6.13 | 8.73 | 2.38 | 7.77 |

All values are stored in `model_metrics`; read them from the database, do not hard-code them.
