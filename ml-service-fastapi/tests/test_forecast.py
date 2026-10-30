"""forecast.py: naive reference forecast and Markov Switching regime, no DB needed."""
from pathlib import Path

import pandas as pd
import pytest

import forecast
from forecast import load_csv, run_forecast

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def raw():
    return load_csv(FIX)


@pytest.fixture(scope="module")
def thesis_start(raw):
    return run_forecast(*raw, through="2023-12-01")


def test_first_thesis_test_month(thesis_start):
    # Thesis Chapter 4: the January 2024 naive forecast is 26.99 PHP/kg
    assert thesis_start.data_through == pd.Timestamp("2023-12-01")
    assert thesis_start.target_month == pd.Timestamp("2024-01-01")
    ref = thesis_start.forecasts[thesis_start.forecasts["is_reference"]]
    assert list(ref["model_name"]) == ["naive"]
    assert round(float(ref["predicted_price"].iloc[0]), 2) == 26.99


def test_live_run_forecasts_month_after_last_data(raw):
    result = run_forecast(*raw)
    assert result.target_month == pd.Timestamp("2026-01-01")
    # Naive = December 2025 price (thesis test_forecasts.csv: 60.28)
    assert round(float(result.forecasts["predicted_price"].iloc[0]), 2) == 60.28


def test_no_look_ahead(raw, thesis_start):
    # Corrupting every month after the cut-off must not change the result
    monthly, exports = raw
    corrupted = monthly.copy()
    after = corrupted.index > "2023-12-01"
    corrupted.loc[after, forecast.AREAS] = 999.0
    corrupted.loc[after, "coconut_oil_usd_mt"] = 1.0
    result = run_forecast(corrupted, exports, through="2023-12-01")
    pd.testing.assert_frame_equal(result.forecasts, thesis_start.forecasts)
    pd.testing.assert_series_equal(result.p_high, thesis_start.p_high)


def test_regime_probabilities(raw, thesis_start):
    p = thesis_start.p_high
    assert p.between(0, 1).all()
    assert p.index[0] == pd.Timestamp("2019-03-01")
    assert p.index[-1] == pd.Timestamp("2023-12-01")
    # Full sample: the 2025 price swings (Apr +16%, Aug -24%) are the volatile regime
    full = run_forecast(*raw).p_high
    assert full.loc["2025-08-01"] > 0.5
    assert full.loc["2025-09-01"] > 0.5


def test_dry_run_prints_and_writes_nothing(capsys, monkeypatch):
    monkeypatch.setattr(forecast, "write_results", lambda *a, **k: pytest.fail("wrote to DB"))
    assert forecast.main(["--csv", str(FIX), "--through", "2023-12-01", "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert "Target month:  2024-01-01" in out
    assert "26.99  (reference)" in out
    assert "nothing written" in out


@pytest.mark.parametrize("argv", [["--through", "2023-12-01"], ["--csv", str(FIX)]])
def test_replay_options_require_dry_run(argv):
    with pytest.raises(SystemExit):
        forecast.main(argv)
