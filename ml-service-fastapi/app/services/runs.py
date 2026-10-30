"""
Job runner around forecast.run_job (decision D9).

Jobs are kept in memory only: the durable record of a written run is the
model_runs row. One job runs at a time; a monthly cadence needs no queue.
"""
import threading
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import forecast
from app.schemas import ForecastOut, Job, RegimeOut, RunRequest, RunResult

MAX_JOBS = 50

_jobs: OrderedDict[str, Job] = OrderedDict()
_lock = threading.Lock()


class JobConflict(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_run_result(result: forecast.ForecastResult) -> RunResult:
    p = float(result.p_high.iloc[-1])
    return RunResult(
        data_through=result.data_through.date(),
        target_month=result.target_month.date(),
        forecasts=[ForecastOut(model=f.model_name, price_php_kg=round(f.predicted_price, 2),
                               is_reference=bool(f.is_reference))
                   for f in result.forecasts.itertuples()],
        regime=RegimeOut(month=result.p_high.index[-1].date(), p_high_volatility=round(p, 3),
                         label="high" if p > 0.5 else "low"),
    )


def create_job(req: RunRequest) -> Job:
    with _lock:
        if any(j.status in ("queued", "running") for j in _jobs.values()):
            raise JobConflict("A forecast job is already running")
        job = Job(job_id=str(uuid.uuid4()), status="queued", dry_run=req.dry_run,
                  through=req.through, created_at=_now())
        _jobs[job.job_id] = job
        while len(_jobs) > MAX_JOBS:
            _jobs.popitem(last=False)
        return job


def execute_job(job_id: str, csv_dir: Path | None) -> None:
    job = _jobs[job_id]
    job.status = "running"
    try:
        result, run_id = forecast.run_job(
            job.dry_run, job.through.isoformat() if job.through else None, csv_dir)
        job.result, job.model_run_id, job.status = to_run_result(result), run_id, "succeeded"
    except Exception as exc:  # reported through GET /runs/{id}
        job.error, job.status = f"{type(exc).__name__}: {exc}"[:1000], "failed"
    finally:
        job.finished_at = _now()


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def list_jobs() -> list[Job]:
    return list(reversed(_jobs.values()))


def clear_jobs() -> None:
    """For tests."""
    with _lock:
        _jobs.clear()
