"""
Monthly forecast job: Supabase raw data -> forecasts and regime probabilities.

Runs once a month (GitHub Actions) per docs/architecture.md decisions D1-D4:
  1. read monthly_data and annual_exports
  2. build features with features.py (t-1 inputs only)
  3. naive forecast for the month after the last observed month (reference, D2)
  4. Markov Switching filtered probability of the high-volatility regime (D3)
  5. refit SARIMAX, XGBoost (Full, RFE, MS-RFE) and LSTM on all observed months
     with the thesis hyperparameters (D4); comparison only, never the reference
  6. write model_runs, forecasts, regime_probabilities

Model settings come from ml-training/artifacts/config/summary.json. How each
model is set up (scaling, targets, seeds) was recovered from the saved thesis
models in ml-training/artifacts/models/; see docs/data-dictionary.md.

Usage:
  python forecast.py                                   # live run, writes to Supabase
  python forecast.py --dry-run                         # compute and print, write nothing
  python forecast.py --through 2023-12-01 --dry-run    # pretend data end at that month
  python forecast.py --csv tests/fixtures --dry-run    # read CSVs instead of Supabase
  python forecast.py --models naive,sarimax --dry-run  # run only some models
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import warnings
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression
from statsmodels.tsa.statespace.sarimax import SARIMAX

from features import AREAS, FEATURES, build_features, next_month_row

THESIS_CONFIG = Path(__file__).resolve().parent.parent / "ml-training" / "artifacts" / "config" / "summary.json"

# Model names as stored in the database (CLAUDE.md conventions)
MODELS = ("naive", "sarimax", "xgboost_full", "xgboost_rfe", "ms_xgboost_rfe", "lstm")
XGB_CONFIG_NAMES = {"xgboost_full": "XGBoost-Full", "xgboost_rfe": "XGBoost-RFE",
                    "ms_xgboost_rfe": "MS-XGBoost-RFE"}
XGB_SEED = 42    # random_state of the saved thesis models
LSTM_SEED = 0    # model_LSTM_seed0.keras

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
    notes: list[str] = field(default_factory=list)   # trained models that were skipped, and why


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
    res, high = fit_regimes(log_returns)
    return pd.Series(np.asarray(res.filtered_marginal_probabilities)[:, high],
                     index=res.model.data.row_labels, name="p_high_volatility")


def fit_regimes(log_returns: pd.Series):
    """The fitted Markov Switching model and the index of its high-volatility regime."""
    r = log_returns.dropna() * 100
    r.index.freq = "MS"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # convergence chatter from the EM start-up
        res = MarkovRegression(r, k_regimes=2, switching_variance=True).fit()
    return res, int(np.argmax([res.params["sigma2[0]"], res.params["sigma2[1]"]]))


def load_thesis_config(path: Path = THESIS_CONFIG) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def standardize(df: pd.DataFrame, ref: pd.DataFrame) -> pd.DataFrame:
    """StandardScaler (population std) fitted on the training rows `ref`, as in the thesis."""
    return (df - ref.mean()) / ref.std(ddof=0)


def fit_sarimax(train: pd.DataFrame, x_next: pd.DataFrame, cfg: dict) -> float:
    """SARIMAX on the log price with standardized exogenous inputs; returns the log return."""
    exog = cfg["sarimax_exog"]
    y = np.log(train["Target_Price_PHPkg"])
    y.index.freq = "MS"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        res = SARIMAX(y, exog=standardize(train[exog], train[exog]),
                      order=tuple(cfg["sarimax_order"]),
                      seasonal_order=tuple(cfg["sarimax_seasonal_order"]), trend="n").fit(disp=False)
        log_price = float(res.forecast(1, exog=standardize(x_next[exog], train[exog])).iloc[0])
    return log_price - np.log(float(x_next["Price_Lag1"].iloc[0]))


def fit_xgboost(train: pd.DataFrame, x_next: pd.DataFrame, params: dict,
                features: list[str]) -> float:
    """XGBoost on the log return. One thread, so a refit is repeatable on the same machine."""
    import xgboost
    model = xgboost.XGBRegressor(**params, random_state=XGB_SEED, tree_method="hist", n_jobs=1)
    model.fit(train[features], train["Target_LogReturn"])
    return float(model.predict(x_next[features])[0])


def fit_lstm(train: pd.DataFrame, x_next: pd.DataFrame, params: dict,
             features: list[str]) -> float:
    """
    LSTM on windows of the last L months of standardized features; the target
    (log return) is standardized too. Returns the log return.
    """
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    import keras
    import tensorflow as tf

    keras.utils.set_random_seed(LSTM_SEED)
    tf.config.experimental.enable_op_determinism()
    L, n_layers = int(params["L"]), int(params["n_layers"])
    X = standardize(pd.concat([train[features], x_next[features]]), train[features]).to_numpy("float32")
    y = train["Target_LogReturn"]
    y_scaled = ((y - y.mean()) / y.std(ddof=0)).to_numpy("float32")
    windows = np.stack([X[i - L + 1:i + 1] for i in range(L - 1, len(X))])  # window ends at month i

    model = keras.Sequential(
        [keras.Input((L, len(features)))]
        + [keras.layers.LSTM(int(params["units"]), dropout=params["dropout"],
                             return_sequences=i < n_layers - 1) for i in range(n_layers)]
        + [keras.layers.Dense(1)])
    model.compile(optimizer=keras.optimizers.Adam(params["lr"]), loss="mse")
    model.fit(windows[:-1], y_scaled[L - 1:], epochs=int(params["epochs"]), verbose=0)
    out = float(model.predict(windows[-1:], verbose=0)[0, 0])
    return out * float(y.std(ddof=0)) + float(y.mean())


def run_forecast(monthly: pd.DataFrame, exports: pd.DataFrame, through: str | None = None,
                 models: Sequence[str] = MODELS, cfg: dict | None = None) -> ForecastResult:
    """Forecast the month after `through` (default: the last observed month)."""
    unknown = set(models) - set(MODELS)
    if unknown:
        raise ValueError(f"Unknown models: {sorted(unknown)}")
    monthly = monthly.sort_index()
    if through is not None:
        monthly = monthly.loc[:through]   # rule 1: nothing after the cut-off is used
    data_through = monthly.index.max()

    row = next_month_row(monthly, exports)
    target_month = row.index[0]
    last_price = float(row["Price_Lag1"].iloc[0])

    # Regimes from the first observed return (Feb 2019), as in the thesis
    returns = build_features(monthly, exports, first_month=monthly.index.min())["Target_LogReturn"]
    p_high = regime_probabilities(returns)

    # Training rows = every observed month of the modelling period; x_next = the target month
    frame = pd.concat([build_features(monthly, exports), row])
    frame["MS_Prob_t1"] = p_high.shift(1, freq="MS").reindex(frame.index)
    train, x_next = frame.iloc[:-1], frame.iloc[[-1]]

    rows = [{"model_name": "naive", "predicted_price": last_price,
             "predicted_logreturn": None, "is_reference": True}]
    notes: list[str] = []
    trained = [m for m in MODELS if m in models and m != "naive"]
    if trained:
        cfg = cfg or load_thesis_config()
        rfe = cfg["rfe_features"]
        fitters = {
            "sarimax": lambda: fit_sarimax(train, x_next, cfg),
            "xgboost_full": lambda: fit_xgboost(train, x_next, cfg["xgb_params"]["XGBoost-Full"], FEATURES),
            "xgboost_rfe": lambda: fit_xgboost(train, x_next, cfg["xgb_params"]["XGBoost-RFE"], rfe),
            "ms_xgboost_rfe": lambda: fit_xgboost(train, x_next, cfg["xgb_params"]["MS-XGBoost-RFE"],
                                                  rfe + ["MS_Prob_t1"]),
            "lstm": lambda: fit_lstm(train, x_next, cfg["lstm_params"], rfe),
        }
        for name in trained:
            # A failed comparison model must not block the reference forecast
            try:
                r = fitters[name]()
            except Exception as exc:
                notes.append(f"{name} skipped: {type(exc).__name__}: {exc}"[:300])
                continue
            rows.append({"model_name": name, "predicted_price": last_price * float(np.exp(r)),
                         "predicted_logreturn": r, "is_reference": False})

    return ForecastResult(data_through, target_month, pd.DataFrame(rows), p_high, notes)


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
            conn.execute(text("update public.model_runs set status = 'succeeded', notes = :notes "
                              "where id = :id"),
                         {"id": run_id, "notes": "; ".join(result.notes)[:1000] or None})
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
        *(f"  {f.model_name:<16}{f.predicted_price:8.2f}"
          f"{'  (reference)' if f.is_reference else '  (comparison only)'}"
          for f in result.forecasts.itertuples()),
        *(f"  note: {n}" for n in result.notes),
        "",
        f"Regime at {result.p_high.index[-1]:%Y-%m}: {'high' if p > 0.5 else 'low'} "
        f"(P(high volatility) = {p:.3f})",
        "Last 6 months of P(high volatility):",
        *(f"  {m:%Y-%m}  {v:.3f}" for m, v in result.p_high.tail(6).items()),
    ]
    return "\n".join(lines)


def run_job(dry_run: bool, through: str | None = None, csv: Path | None = None,
            models: Sequence[str] | None = None) -> tuple[ForecastResult, str | None]:
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

    result = run_forecast(monthly, exports, through, MODELS if models is None else models)
    run_id = None if dry_run else write_results(engine, result)
    return result, run_id


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="compute and print, write nothing")
    ap.add_argument("--through", help="use only data up to this month (YYYY-MM-01); needs --dry-run")
    ap.add_argument("--csv", type=Path, help="read monthly_data.csv and annual_exports.csv from this folder")
    ap.add_argument("--models", help=f"comma-separated subset of {','.join(MODELS)} (default: all)")
    args = ap.parse_args(argv)
    models = [m.strip() for m in args.models.split(",")] if args.models else None
    if models is not None and "naive" not in models:
        ap.error("--models must include naive (the reference forecast)")

    try:
        result, run_id = run_job(args.dry_run, args.through, args.csv, models)
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
