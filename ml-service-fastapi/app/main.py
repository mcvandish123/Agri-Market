from fastapi import FastAPI

from app.routers.health import router as health_router
from app.routers.runs import router as runs_router

app = FastAPI(title="ML Service")

app.include_router(health_router)
app.include_router(runs_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "ML service is running"}
