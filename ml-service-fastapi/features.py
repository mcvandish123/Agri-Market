"""
Feature pipeline: raw monthly data -> model-ready feature matrix.

This is a faithful port of the thesis dataset build (Section 3.2.2.4).
Every feature for month t uses only information available by the end of
month t-1 (or earlier), so there is no look-ahead leakage.

Inputs (pandas DataFrames, normally read from Supabase):
  monthly  - rows of public.monthly_data, indexed by month (first day, Timestamp)
  exports  - rows of public.annual_exports: columns year, unit_value_usd_kg

Output: DataFrame indexed by month with the 2 target columns + 25 features,
column names identical to copra_training_dataset.csv.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# 2015-2018 monthly mean VPD (kPa) at the PAGASA station, used as the
# baseline for VPD anomalies. Do not recompute: these are fixed constants.
VPD_BASELINE = {
    1: 0.749024, 2: 0.819385, 3: 1.041217, 4: 1.087128, 5: 0.910110, 6: 0.794519,
    7: 0.831765, 8: 0.901470, 9: 0.829432, 10: 0.771242, 11: 0.799449, 12: 0.805832,
}

AREAS = [
    "farmgate_davao_city", "farmgate_davao_de_oro", "farmgate_davao_del_norte",
    "farmgate_davao_del_sur", "farmgate_davao_occidental", "farmgate_davao_oriental",
]

FEATURES = [
    "Price_Lag1", "Price_Lag2", "Price_LogRet_Lag1", "Month_sin", "Month_cos",
    "Temp_C_t1", "RH_pct_t1", "Rain_mm_t1", "Rain_mm_Lag12", "VPD_kPa_t1",
    "VPDanom_12mSum_t1", "CPI_MoM_pct_t1", "ExportUV_USDkg_prevYear",
    "CoconutOil_USDmt_t1", "CoconutOil_LogRet_t1", "PalmOil_USDmt_t1",
    "PalmOil_LogRet_t1", "PalmKernelOil_USDmt_t1", "PalmKernelOil_LogRet_t1",
    "SoybeanOil_USDmt_t1", "SoybeanOil_LogRet_t1", "CoconutPalm_Ratio_t1",
    "PHPUSD_t1", "PHPUSD_LogRet_t1", "CoconutOil_PHPkg_t1",
]
TARGETS = ["Target_Price_PHPkg", "Target_LogReturn"]


def vpd_kpa(temp_c: pd.Series, rh_pct: pd.Series) -> pd.Series:
    """Vapor pressure deficit via the Tetens equation."""
    return 0.61078 * np.exp(17.27 * temp_c / (temp_c + 237.3)) * (1 - rh_pct / 100)


def build_features(monthly: pd.DataFrame, exports: pd.DataFrame,
                   first_month: str = "2019-03-01") -> pd.DataFrame:
    D = monthly.sort_index().copy()
    num = [c for c in D.columns if c != "price_valid"]
    D[num] = D[num].apply(pd.to_numeric, errors="coerce")
    D = D.asfreq("MS")  # a missing month becomes a NaN row, so gaps surface as NaN features

    # Regional average of the six areas; invalid (2018) prices are excluded
    price = D[AREAS].mean(axis=1, skipna=False)
    price[~D["price_valid"].astype(bool)] = np.nan

    vpd = vpd_kpa(D["temp_c"], D["rh_pct"])
    vpd_anom = vpd - D.index.month.map(VPD_BASELINE).values
    uv = dict(zip(exports["year"].astype(int), exports["unit_value_usd_kg"].astype(float)))

    lag = lambda s, k=1: s.shift(k)
    logret = lambda s: np.log(s).diff()

    T = pd.DataFrame(index=D.index)
    T["Target_Price_PHPkg"] = price
    T["Target_LogReturn"] = logret(price)
    T["Price_Lag1"] = lag(price)
    T["Price_Lag2"] = lag(price, 2)
    T["Price_LogRet_Lag1"] = lag(logret(price))
    T["Month_sin"] = np.sin(2 * np.pi * D.index.month / 12)
    T["Month_cos"] = np.cos(2 * np.pi * D.index.month / 12)
    T["Temp_C_t1"] = lag(D["temp_c"])
    T["RH_pct_t1"] = lag(D["rh_pct"])
    T["Rain_mm_t1"] = lag(D["rain_mm"])
    T["Rain_mm_Lag12"] = lag(D["rain_mm"], 12)
    T["VPD_kPa_t1"] = lag(vpd)
    T["VPDanom_12mSum_t1"] = lag(vpd_anom.rolling(12).sum())
    T["CPI_MoM_pct_t1"] = lag(D["cpi_region11"].pct_change() * 100)
    # Previous year's export unit value. PSA publishes annual trade data with a
    # delay, so for live forecasts the most recent available year is carried
    # forward (documented in docs/architecture.md, decision D6).
    def prev_year_uv(y: int) -> float:
        avail = [k for k in uv if k <= y - 1]
        return uv[max(avail)] if avail else np.nan
    T["ExportUV_USDkg_prevYear"] = [prev_year_uv(y) for y in D.index.year]
    for col, name in [("coconut_oil_usd_mt", "CoconutOil"), ("palm_oil_usd_mt", "PalmOil"),
                      ("palm_kernel_oil_usd_mt", "PalmKernelOil"),
                      ("soybean_oil_usd_mt", "SoybeanOil")]:
        T[f"{name}_USDmt_t1"] = lag(D[col])
        T[f"{name}_LogRet_t1"] = lag(logret(D[col]))
    T["CoconutPalm_Ratio_t1"] = lag(D["coconut_oil_usd_mt"] / D["palm_oil_usd_mt"])
    T["PHPUSD_t1"] = lag(D["php_usd"])
    T["PHPUSD_LogRet_t1"] = lag(logret(D["php_usd"]))
    T["CoconutOil_PHPkg_t1"] = lag(D["coconut_oil_usd_mt"] * D["php_usd"] / 1000)

    return T.loc[first_month:, TARGETS + FEATURES].round(6)


def next_month_row(monthly: pd.DataFrame, exports: pd.DataFrame) -> pd.DataFrame:
    """
    Feature row for the month AFTER the last observed month (the live forecast).
    Appends an empty month so that its t-1 features are filled from the last
    observed month; its targets stay NaN.
    """
    last = monthly.index.max()
    nxt = last + pd.offsets.MonthBegin(1)
    ext = pd.concat([monthly, pd.DataFrame(index=[nxt])])
    ext.loc[nxt, "price_valid"] = True
    feats = build_features(ext, exports)
    row = feats.loc[[nxt]]
    missing = row[FEATURES].columns[row[FEATURES].isna().any()].tolist()
    if missing:
        raise ValueError(f"Cannot forecast {nxt:%Y-%m}: missing inputs {missing}")
    return row
