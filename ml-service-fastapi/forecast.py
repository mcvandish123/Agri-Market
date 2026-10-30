"""
Monthly forecast job: Supabase raw data -> forecasts and regime probabilities.

Runs once a month (GitHub Actions) per docs/architecture.md decisions D1-D4:
  1. read monthly_data and annual_exports
  2. build features with features.py (t-1 inputs only)
  3. naive forecast for the month after the last observed month (reference, D2)
  4. Markov Switching filtered probability of the high-volatility regime (D3)
  5. write model_runs, forecasts, regime_probabilities

SARIMAX, XGBoost and LSTM refits (D4) are not added yet.

Usage:
  python forecast.py                                   # live run, writes to Supabase
  python forecast.py --dry-run                         # compute and print, write nothing
  python forecast.py --through 2023-12-01 --dry-run    # pretend data end at that month
  python forecast.py --csv tests/fixtures --dry-run    # read CSVs instead of Supabase
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

from features import AREAS, build_features, next_month_row

# Raw inputs read from monthly_data (same columns as tests/fixtures/monthly_data.csv)
MONTHLY_COLUMNS = AREAS + [
    "price_valid", "cpi_region11", "temp_c", "rh_pct", "rain_mm", "vpd_kpa",
    "coconut_oil_usd_mt", "palm_oil_usd_mt", "palm_kernel_oil_usd_mt",
    "soybean_oil_usd_mt", "php_usd",
]


@dataclass
class ForecastResult:
    data_through: pd.Timestamp
    target_month: pd.Timestamp
    forecasts: pd.DataFrame       # model_name, predicted_price, predicted_logreturn, is_reference
    p_high: pd.Series             # filtered P(high volatility), indexed by month


# ---------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------
def load_csv(folder: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    monthly = pd.read_csv(folder / "monthly_data.csv", parse_dates=["month"]).set_index("month")
    exports = pd.read_csv(folder / "annual_exports.csv")
    return monthly[MONTHLY_COLUMNS], exports[["year", "unit_value_usd_kg"]]


def make_engine(db_url: str):
    from sqlalchemy import create_engine
    # Supabase gives postgresql://...; SQLAlchemy needs the psycopg (v3) driver named
    if db_url.startswith("postgresql://"):
        db_url = "postgresql+psycopg://" + db_url[len("postgresql://"):]
    return create_engine(db_url)


def load_db(engine) -> tuple[pd.DataFrame, pd.DataFrame]:
    cols = ", ".join(["month"] + MONTHLY_COLUMNS)
    monthly = pd.read_sql(f"select {cols} from public.monthly_data order by month",
                          engine, parse_dates=["month"]).set_index("month")
    exports = pd.read_sql("select year, unit_value_usd_kg from public.annual_exports order by year",
                          engine)
    return monthly, exports


# ---------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------
def regime_probabilities(log_returns: pd.Series) -> pd.Series:
    """
    Two-regime Markov Switching model with switching mean and variance, fitted on
    all observed log returns (in percent, which keeps the optimizer stable).
    Returns the filtered probability of the high-volatility regime, i.e. the
    regime with the larger variance; regime numbering from statsmodels is arbitrary.
    """
    r = log_returns.dropna() * 100
    r.index.freq = "MS"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # convergence chatter from the EM start-up
        res = MarkovRegression(r, k_regimes=2, switching_variance=True).fit()
    high = int(np.argmax([res.params["sigma2[0]"], res.params["sigma2[1]"]]))
    return pd.Series(np.asarray(res.filtered_marginal_probabilities)[:, high],
                     index=r.index, name="p_high_volatility")


def run_forecast(monthly: pd.DataFrame, exports: pd.DataFrame,
                 through: str | None = None) -> ForecastResult:
    """Forecast the month after `through` (default: the last observed month)."""
    monthly = monthly.sort_index()
    if through is not None:
        monthly = monthly.loc[:through]   # rule 1: nothing after the cut-off is used
    data_through = monthly.index.max()

    row = next_month_row(monthly, exports)
    target_month = row.index[0]
    naive = float(row["Price_Lag1"].iloc[0])
    forecasts = pd.DataFrame([{
        "model_name": "naive", "predicted_price": naive,
        "predicted_logreturn": None, "is_reference": True,
    }])

    log_returns = build_features(monthly, exports)["Target_LogReturn"]
    return ForecastResult(data_through, target_month, forecasts, regime_probabilities(log_returns))


# ---------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------
def code_version() -> str | None:
    if os.environ.get("GITHUB_SHA"):
        return os.environ["GITHUB_SHA"]
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True,
                              check=True, cwd=Path(__file__).parent).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def write_results(engine, result: ForecastResult, run_kind: str = "live") -> str:
    """Insert one model run and its rows. The run is marked failed if any insert fails."""
    from sqlalchemy import text

    with engine.begin() as conn:
        run_id = conn.execute(text(
            "insert into public.model_runs (run_kind, data_through, code_version) "
            "values (:kind, :through, :version) returning id"),
            {"kind": run_kind, "through": result.data_through.date(),
             "version": code_version()}).scalar_one()
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "insert into public.forecasts (run_id, target_month, model_name, "
                "predicted_price, predicted_logreturn, is_reference) "
                "values (:run_id, :target, :model_name, :predicted_price, "
                ":predicted_logreturn, :is_reference)"),
                [{"run_id": run_id, "target": result.target_month.date(),
                  **f, "predicted_price": round(f["predicted_price"], 4)}
                 for f in result.forecasts.to_dict("records")])
            conn.execute(text(
                "insert into public.regime_probabilities (run_id, month, p_high_volatility) "
                "values (:run_id, :month, :p)"),
                [{"run_id": run_id, "month": m.date(), "p": round(float(p), 6)}
                 for m, p in result.p_high.items()])
            conn.execute(text("update public.model_runs set status = 'succeeded' where id = :id"),
                         {"id": run_id})
    except Exception as exc:
        with engine.begin() as conn:
            conn.execute(text("update public.model_runs set status = 'failed', notes = :notes "
                              "where id = :id"), {"id": run_id, "notes": str(exc)[:1000]})
        raise
    return str(run_id)


def report(result: ForecastResult) -> str:
    p = float(result.p_high.iloc[-1])
    lines = [
        f"Data through:  {result.data_through:%Y-%m-%d}",
        f"Target month:  {result.target_month:%Y-%m-%d}",
        "",
        "Forecasts (PHP/kg):",
        *(f"  {f.model_name:<16}{f.predicted_price:8.2f}{'  (reference)' if f.is_reference else ''}"
          for f in result.forecasts.itertuples()),
        "",
        f"Regime at {result.p_high.index[-1]:%Y-%m}: {'high' if p > 0.5 else 'low'} "
        f"(P(high volatility) = {p:.3f})",
        "Last 6 months of P(high volatility):",
        *(f"  {m:%Y-%m}  {v:.3f}" for m, v in result.p_high.tail(6).items()),
    ]
    return "\n".join(lines)


def run_job(dry_run: bool, through: str | None = None,
            csv: Path | None = None) -> tuple[ForecastResult, str | None]:
    """
    One full job, shared by the CLI and the FastAPI runner.
    Returns the result and the model_runs id (None for a dry run).
    """
    # A --through run is a historical replay; writing it would create a 'live'
    # run that the app would show as the latest forecast.
    if through and not dry_run:
        raise ValueError("--through is only allowed with --dry-run")
    if csv and not dry_run:
        raise ValueError("--csv is only allowed with --dry-run")

    engine = None
    if csv:
        monthly, exports = load_csv(csv)
    else:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).parent / ".env")
        db_url = os.environ.get("SUPABASE_DB_URL")
        if not db_url:
            raise ValueError("SUPABASE_DB_URL is not set (see .env.example)")
        engine = make_engine(db_url)
        monthly, exports = load_db(engine)

    result = run_forecast(monthly, exports, through)
    run_id = None if dry_run else write_results(engine, result)
    return result, run_id


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="compute and print, write nothing")
    ap.add_argument("--through", help="use only data up to this month (YYYY-MM-01); needs --dry-run")
    ap.add_argument("--csv", type=Path, help="read monthly_data.csv and annual_exports.csv from this folder")
    args = ap.parse_args(argv)

    try:
        result, run_id = run_job(args.dry_run, args.through, args.csv)
    except ValueError as exc:
        ap.error(str(exc))
    print(report(result))
    if run_id is None:
        print("\nDry run: nothing written.")
    else:
        print(f"\nWrote model run {run_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
