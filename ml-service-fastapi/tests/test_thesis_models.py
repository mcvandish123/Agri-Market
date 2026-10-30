"""
The saved thesis models, fed by features.py, reproduce the Chapter 4 test
forecasts. This pins down how each model was set up (targets, scaling, the
MS_Prob_t1 feature), which forecast.py's refits rely on.
"""
import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

import forecast
from features import build_features

FIX = Path(__file__).parent / "fixtures"
ARTIFACTS = Path(forecast.THESIS_CONFIG).parent.parent
TEST_MONTHS = pd.date_range("2024-01-01", "2025-12-01", freq="MS")


@pytest.fixture(scope="module")
def frame():
    monthly, exports = forecast.load_csv(FIX)
    F = build_features(monthly, exports)
    F.index.freq = "MS"
    # MS_Prob_t1: regime model fitted on training returns (from Feb 2019), then
    # filtered over the whole series with those fixed parameters, lagged one month
    returns = build_features(monthly, exports, first_month="2019-01-01")["Target_LogReturn"]
    res, high = forecast.fit_regimes(returns.loc[:"2023-12-01"])
    r = returns.dropna() * 100
    r.index.freq = "MS"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        filt = MarkovRegression(r, k_regimes=2, switching_variance=True).filter(res.params)
    p = pd.Series(np.asarray(filt.filtered_marginal_probabilities)[:, high], index=r.index)
    F["MS_Prob_t1"] = p.shift(1, freq="MS").reindex(F.index)
    return F


@pytest.fixture(scope="module")
def thesis():
    return pd.read_csv(ARTIFACTS / "results" / "test_forecasts.csv", parse_dates=["Date"]).set_index("Date")


@pytest.mark.parametrize("name", ["XGBoost-Full", "XGBoost-RFE", "MS-XGBoost-RFE"])
def test_saved_xgboost_reproduces_thesis(frame, thesis, name):
    import xgboost
    # The .joblib files do not unpickle with this xgboost build; the .json files
    # hold the same boosters (exported from the .joblib payload).
    bst = xgboost.Booster(model_file=str(ARTIFACTS / "models" / f"model_{name}.json"))
    X = frame.loc[TEST_MONTHS, bst.feature_names]
    r = bst.predict(xgboost.DMatrix(X, feature_names=bst.feature_names))
    price = frame.loc[TEST_MONTHS, "Price_Lag1"] * np.exp(r)
    assert (price - thesis.loc[TEST_MONTHS, name]).abs().max() < 1e-3


def test_saved_sarimax_reproduces_thesis(frame, thesis):
    with open(ARTIFACTS / "models" / "model_SARIMAX.pkl", "rb") as f:
        saved = pickle.load(f)
    exog = list(saved.model.exog_names)
    train = frame.loc[:"2023-12-01"]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        full = saved.apply(np.log(frame["Target_Price_PHPkg"]),
                           exog=forecast.standardize(frame[exog], train[exog]))
        pred = full.get_prediction(start=TEST_MONTHS[0], end=TEST_MONTHS[-1]).predicted_mean
    assert (np.exp(pred) - thesis.loc[TEST_MONTHS, "SARIMAX"]).abs().max() < 1e-3
