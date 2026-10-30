from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.auth import require_api_key
from app.config import Settings, get_settings
from app.schemas import Job, RunRequest
from app.services import runs

router = APIRouter(prefix="/runs", tags=["runs"], dependencies=[Depends(require_api_key)])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=Job, response_model_by_alias=True)
def start_run(req: RunRequest, background: BackgroundTasks,
              settings: Settings = Depends(get_settings)) -> Job:
    if settings.csv_dir and not req.dry_run:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "ML_CSV_DIR is set (local CSV data): only dry runs are allowed")
    try:
        job = runs.create_job(req)
    except runs.JobConflict as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    background.add_task(runs.execute_job, job.job_id, settings.csv_dir)
    return job


@router.get("", response_model=list[Job], response_model_by_alias=True)
def list_runs() -> list[Job]:
    return runs.list_jobs()


@router.get("/{job_id}", response_model=Job, response_model_by_alias=True)
def get_run(job_id: str) -> Job:
    job = runs.get_job(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job
