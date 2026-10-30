from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    # API JSON fields are camelCase (CLAUDE.md conventions)
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RunRequest(CamelModel):
    dry_run: bool = False
    through: date | None = None

    @field_validator("through")
    @classmethod
    def first_of_month(cls, v: date | None) -> date | None:
        if v is not None and v.day != 1:
            raise ValueError("through must be the first day of a month (YYYY-MM-01)")
        return v

    @model_validator(mode="after")
    def through_needs_dry_run(self) -> "RunRequest":
        # A replay written as a live run would become the app's latest forecast
        if self.through is not None and not self.dry_run:
            raise ValueError("through is only allowed with dryRun = true")
        return self


class ForecastOut(CamelModel):
    model: str
    price_php_kg: float
    is_reference: bool


class RegimeOut(CamelModel):
    month: date
    p_high_volatility: float
    label: Literal["high", "low"]


class RunResult(CamelModel):
    data_through: date
    target_month: date
    forecasts: list[ForecastOut]
    regime: RegimeOut


class Job(CamelModel):
    job_id: str
    status: Literal["queued", "running", "succeeded", "failed"]
    dry_run: bool
    through: date | None
    created_at: datetime
    finished_at: datetime | None = None
    model_run_id: str | None = None   # model_runs.id; None for dry runs
    error: str | None = None
    result: RunResult | None = None
