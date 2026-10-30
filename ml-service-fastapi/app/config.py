import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent

load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    # Shared secret NestJS sends in the x-ml-key header; never logged
    ml_api_key: str | None
    # Optional: read fixture CSVs instead of Supabase (local development, dry runs only)
    csv_dir: Path | None


def get_settings() -> Settings:
    csv_dir = os.environ.get("ML_CSV_DIR")
    return Settings(
        ml_api_key=os.environ.get("ML_API_KEY") or None,
        csv_dir=(ROOT / csv_dir) if csv_dir else None,
    )
