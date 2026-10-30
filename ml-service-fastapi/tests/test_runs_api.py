"""FastAPI job runner: auth, validation, dry runs on the fixture CSVs, live run wiring."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import forecast
from app.config import Settings, get_settings
from app.main import app
from app.services import runs

FIX = Path(__file__).parent / "fixtures"
KEY = "test-key"
AUTH = {"x-ml-key": KEY}


@pytest.fixture
def client():
    settings = Settings(ml_api_key=KEY, csv_dir=FIX)
    app.dependency_overrides[get_settings] = lambda: settings
    runs.clear_jobs()
    yield TestClient(app)
    app.dependency_overrides.clear()
    runs.clear_jobs()


def test_health_needs_no_key(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("headers", [{}, {"x-ml-key": "wrong"}])
def test_runs_require_key(client, headers):
    assert client.post("/runs", json={"dryRun": True}, headers=headers).status_code == 401
    assert client.get("/runs", headers=headers).status_code == 401


def test_unconfigured_key_is_503(client):
    app.dependency_overrides[get_settings] = lambda: Settings(ml_api_key=None, csv_dir=FIX)
    assert client.post("/runs", json={"dryRun": True}, headers=AUTH).status_code == 503


def test_dry_run_through_2023_12(client):
    r = client.post("/runs", json={"dryRun": True, "through": "2023-12-01"}, headers=AUTH)
    assert r.status_code == 202
    job_id = r.json()["jobId"]
    # TestClient runs background tasks before returning, so the job is finished
    job = client.get(f"/runs/{job_id}", headers=AUTH).json()
    assert job["status"] == "succeeded", job["error"]
    assert job["modelRunId"] is None
    res = job["result"]
    assert res["dataThrough"] == "2023-12-01"
    assert res["targetMonth"] == "2024-01-01"
    assert res["forecasts"] == [{"model": "naive", "pricePhpKg": 26.99, "isReference": True}]
    assert res["regime"]["label"] == "low"
    assert client.get("/runs", headers=AUTH).json()[0]["jobId"] == job_id


@pytest.mark.parametrize("body", [
    {"dryRun": False, "through": "2023-12-01"},   # replay must not be written
    {"dryRun": True, "through": "2023-12-15"},    # not a first-of-month date
])
def test_invalid_requests(client, body):
    assert client.post("/runs", json=body, headers=AUTH).status_code == 422


def test_live_run_refused_on_csv_data(client):
    assert client.post("/runs", json={"dryRun": False}, headers=AUTH).status_code == 400


def test_one_job_at_a_time(client):
    runs.create_job(runs.RunRequest(dry_run=True))   # stays queued
    assert client.post("/runs", json={"dryRun": True}, headers=AUTH).status_code == 409


def test_unknown_job_is_404(client):
    assert client.get("/runs/nope", headers=AUTH).status_code == 404


def test_live_run_records_model_run_id(client, monkeypatch):
    app.dependency_overrides[get_settings] = lambda: Settings(ml_api_key=KEY, csv_dir=None)
    monkeypatch.setattr(forecast, "load_db", lambda engine: forecast.load_csv(FIX))
    monkeypatch.setattr(forecast, "make_engine", lambda url: object())
    monkeypatch.setattr(forecast, "write_results", lambda engine, result: "run-123")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://unused")
    job_id = client.post("/runs", json={}, headers=AUTH).json()["jobId"]
    job = client.get(f"/runs/{job_id}", headers=AUTH).json()
    assert job["status"] == "succeeded", job["error"]
    assert job["modelRunId"] == "run-123"
    assert job["result"]["targetMonth"] == "2026-01-01"


def test_failure_is_reported(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("database unreachable")
    monkeypatch.setattr(forecast, "run_job", boom)
    job_id = client.post("/runs", json={"dryRun": True}, headers=AUTH).json()["jobId"]
    job = client.get(f"/runs/{job_id}", headers=AUTH).json()
    assert job["status"] == "failed"
    assert job["error"] == "RuntimeError: database unreachable"
