import secrets

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


def require_api_key(x_ml_key: str | None = Header(default=None),
                    settings: Settings = Depends(get_settings)) -> None:
    if not settings.ml_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "ML_API_KEY is not configured")
    if x_ml_key is None or not secrets.compare_digest(x_ml_key, settings.ml_api_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing x-ml-key header")
