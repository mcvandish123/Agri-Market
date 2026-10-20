"""The feature pipeline must reproduce the thesis dataset exactly (to rounding)."""
from pathlib import Path

import pandas as pd
import pytest

from features import FEATURES, TARGETS, build_features, next_month_row

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def raw():
    monthly = pd.read_csv(FIX / "monthly_data.csv", parse_dates=["month"]).set_index("month")
    exports = pd.read_csv(FIX / "annual_exports.csv")
    return monthly, exports


def test_reproduces_thesis_dataset(raw):
    monthly, exports = raw
    built = build_features(monthly, exports)
    ref = pd.read_csv(FIX / "copra_training_dataset.csv", parse_dates=["Date"]).set_index("Date")
    assert list(built.index) == list(ref.index)
    diff = (built[TARGETS + FEATURES] - ref[TARGETS + FEATURES]).abs().max()
    assert diff.max() < 1e-3, diff[diff >= 1e-3]


def test_no_missing_features_in_modeling_period(raw):
    monthly, exports = raw
    built = build_features(monthly, exports)
    assert not built[FEATURES].isna().any().any()


def test_next_month_row_uses_only_past_data(raw):
    monthly, exports = raw
    # Forecast January 2024 using data through December 2023 only
    row = next_month_row(monthly.loc[:"2023-12-01"], exports)
    assert row.index[0] == pd.Timestamp("2024-01-01")
    assert row["Target_Price_PHPkg"].isna().all()
    # The naive forecast for Jan 2024 is the Dec 2023 price (thesis: 26.99 PHP/kg)
    assert round(float(row["Price_Lag1"].iloc[0]), 2) == 26.99
