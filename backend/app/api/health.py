"""Health and capability reporting.

The client uses this to decide whether AI features are available, and the
`features` map is the single source of truth for that decision. Nothing is
reported as available unless it is genuinely wired up.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..core.config import Settings, get_settings
from ..schemas.requests import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.version,
        environment=settings.environment,
        features=settings.feature_flags(),
    )
