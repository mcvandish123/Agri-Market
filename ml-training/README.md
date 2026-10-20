# ML job

## Setup

```bash
cd ml
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # then paste the Supabase Session pooler connection string
python -m pytest        # feature pipeline must reproduce the thesis dataset
```

## Exporting from Google Colab

At the end of the training notebook, save the artifacts that `forecast.py`
needs, then download the folder and place it in `ml/artifacts/`:

```python
import json, joblib, os
os.makedirs('artifacts', exist_ok=True)
json.dump(xgb_best_params, open('artifacts/xgb_best_params.json', 'w'), indent=1)    # per XGBoost model
json.dump(lstm_best_params, open('artifacts/lstm_best_params.json', 'w'), indent=1)
json.dump(rfe_selected_features, open('artifacts/rfe_features.json', 'w'), indent=1)
json.dump({'order': sarimax_order, 'exog': sarimax_exog}, open('artifacts/sarimax_spec.json', 'w'), indent=1)
```

Use the variable names from your notebook. Hyperparameters and the RFE feature
list are what matter: per decision D4 the models are refit each month with these
fixed settings, so the fitted model files themselves are optional.

Record the library versions used in Colab (`pip freeze > colab_requirements.txt`)
and keep `requirements.txt` on the same major versions.

## forecast.py (to be written)

```
python forecast.py              # live run: forecast the month after the latest data
python forecast.py --dry-run    # compute and print, write nothing
python forecast.py --through 2023-12-01 --dry-run   # reproduce the start of the thesis test period
```
