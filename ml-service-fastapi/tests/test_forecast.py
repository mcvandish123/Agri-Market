"""forecast.py: naive reference, Markov Switching regime and trained-model refits, no DB needed."""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import forecast
from forecast import MODELS, fit_regimes, load_csv, run_forecast

FIX = Path(__file__).parent / "fixtures"
CONFIG = Path(forecast.THESIS_CONFIG).parent
NAIVE = ("naive",)


@pytest.fixture(scope="module")
def raw():
    return load_csv(FIX)


@pytest.fixture(scope="module")
def thesis_start(raw):
    return run_forecast(*raw, through="2023-12-01", models=NAIVE)


@pytest.fixture(scope="module")
def all_models(raw):
    # Same data the thesis models were trained on (Mar 2019 - Dec 2023)
    return run_forecast(*raw, through="2023-12-01")


def test_first_thesis_test_month(thesis_start):
    # Thesis Chapter 4: the January 2024 naive forecast is 26.99 PHP/kg
    assert thesis_start.data_through == pd.Timestamp("2023-12-01")
    assert thesis_start.target_month == pd.Timestamp("2024-01-01")
    ref = thesis_start.forecasts[thesis_start.forecasts["is_reference"]]
    assert list(ref["model_name"]) == ["naive"]
    assert round(float(ref["predicted_price"].iloc[0]), 2) == 26.99


def test_live_run_forecasts_month_after_last_data(raw):
    result = run_forecast(*raw, models=NAIVE)
    assert result.target_month == pd.Timestamp("2026-01-01")
    # Naive = December 2025 price (thesis test_forecasts.csv: 60.28)
    assert round(float(result.forecasts["predicted_price"].iloc[0]), 2) == 60.28


def test_no_look_ahead(raw, all_models):
    # Corrupting every month after the cut-off must not change any model's result
    monthly, exports = raw
    corrupted = monthly.copy()
    after = corrupted.index > "2023-12-01"
    corrupted.loc[after, forecast.AREAS] = 999.0
    corrupted.loc[after, "coconut_oil_usd_mt"] = 1.0
    result = run_forecast(corrupted, exports, through="2023-12-01")
    pd.testing.assert_frame_equal(result.forecasts, all_models.forecasts)
    pd.testing.assert_series_equal(result.p_high, all_models.p_high)


def test_regime_probabilities(raw, thesis_start):
    p = thesis_start.p_high
    assert p.between(0, 1).all()
    # First observed return is Feb 2019 (2018 prices are invalid)
    assert p.index[0] == pd.Timestamp("2019-02-01")
    assert p.index[-1] == pd.Timestamp("2023-12-01")
    # Full sample: the 2025 price swings (Apr +16%, Aug -24%) are the volatile regime
    full = run_forecast(*raw, models=NAIVE).p_high
    assert full.loc["2025-08-01"] > 0.5
    assert full.loc["2025-09-01"] > 0.5


def test_regime_model_reproduces_thesis(thesis_start, raw):
    # Thesis Markov Switching estimates on the training period (markov_regimes.csv)
    monthly, exports = raw
    returns = forecast.build_features(monthly.loc[:"2023-12-01"], exports,
                                      first_month="2019-01-01")["Target_LogReturn"]
    res, high = fit_regimes(returns)
    low = 1 - high
    ref = pd.read_csv(CONFIG / "markov_regimes.csv").set_index("regime")
    sd = np.sqrt([res.params[f"sigma2[{low}]"], res.params[f"sigma2[{high}]"]])
    assert np.allclose(sd, ref["std. dev. (%)"].loc[["low volatility", "high volatility"]], atol=0.01)
    stay = [res.regime_transition[low, low, 0], res.regime_transition[high, high, 0]]
    assert np.allclose(stay, ref["stay probability"].loc[["low volatility", "high volatility"]], atol=1e-3)


def test_all_models_forecast_thesis_start(all_models):
    f = all_models.forecasts.set_index("model_name")
    assert list(f.index) == list(MODELS)
    assert all_models.notes == []
    assert f["is_reference"].sum() == 1 and f.loc["naive", "is_reference"]
    # SARIMAX refit on the training period reproduces the thesis model exactly
    assert f.loc["sarimax", "predicted_price"] == pytest.approx(27.3864, abs=1e-3)
    # XGBoost/LSTM refits differ from the thesis models (RNG); check they are sane
    naive = f.loc["naive", "predicted_price"]
    trained = f.drop(index="naive")
    assert trained["predicted_price"].between(0.8 * naive, 1.2 * naive).all()
    assert np.allclose(naive * np.exp(trained["predicted_logreturn"].astype(float)),
                       trained["predicted_price"])


def test_forecast_rows_store_null_not_nan(all_models):
    rows = {r["model_name"]: r for r in forecast.forecast_rows(all_models)}
    assert rows["naive"]["predicted_logreturn"] is None    # schema: NULL for naive
    assert rows["naive"]["is_reference"] is True
    assert isinstance(rows["sarimax"]["predicted_logreturn"], float)
    assert rows["sarimax"]["target"] == pd.Timestamp("2024-01-01").date()


def test_refits_are_repeatable(raw, all_models):
    again = run_forecast(*raw, through="2023-12-01", models=("naive", "xgboost_rfe", "lstm"))
    a = all_models.forecasts.set_index("model_name")["predicted_price"]
    b = again.forecasts.set_index("model_name")["predicted_price"]
    assert b.to_dict() == pytest.approx(a[b.index].to_dict(), abs=1e-6)


def test_failed_model_is_skipped_not_fatal(raw, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("no tensorflow")
    monkeypatch.setattr(forecast, "fit_lstm", boom)
    result = run_forecast(*raw, through="2023-12-01", models=("naive", "sarimax", "lstm"))
    assert list(result.forecasts["model_name"]) == ["naive", "sarimax"]
    assert result.notes == ["lstm skipped: RuntimeError: no tensorflow"]


def test_unknown_model_rejected(raw):
    with pytest.raises(ValueError, match="Unknown models"):
        run_forecast(*raw, models=("naive", "prophet"))


def test_dry_run_prints_and_writes_nothing(capsys, monkeypatch):
    monkeypatch.setattr(forecast, "write_results", lambda *a, **k: pytest.fail("wrote to DB"))
    argv = ["--csv", str(FIX), "--through", "2023-12-01", "--dry-run", "--models", "naive,sarimax"]
    assert forecast.main(argv) == 0
    out = capsys.readouterr().out
    assert "Target month:  2024-01-01" in out
    assert "26.99  (reference)" in out
    assert "27.39  (comparison only)" in out
    assert "nothing written" in out


@pytest.mark.parametrize("argv", [
    ["--through", "2023-12-01"],
    ["--csv", str(FIX)],
    ["--csv", str(FIX), "--dry-run", "--models", "sarimax"],   # naive is required
])
def test_cli_rejects_bad_options(argv):
    with pytest.raises(SystemExit):
        forecast.main(argv)
