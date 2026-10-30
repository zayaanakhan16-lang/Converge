"""Place search endpoints.

`/places/search` resolves a typed place name to coordinates through a real
geocoder so a member can choose a discovery area, or look at another part of the
world, without granting device location permission.

The endpoint is read-only and returns published place centres. It never receives
a member's position, so it cannot be used to locate anyone.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..api.dependencies import rate_limited
from ..core.config import Settings, get_settings
from ..schemas.requests import PlaceModel, PlaceSearchResponse
from ..services.geocoding import (
    DEFAULT_RESULTS,
    MAX_RESULTS,
    GeocodingService,
    PlaceKind,
)

router = APIRouter(tags=["places"], dependencies=[Depends(rate_limited)])


def _service(settings: Annotated[Settings, Depends(get_settings)]) -> GeocodingService:
    return GeocodingService(settings)


@router.get("/places/search", response_model=PlaceSearchResponse)
async def search_places(
    service: Annotated[GeocodingService, Depends(_service)],
    q: Annotated[str, Query(min_length=2, max_length=120, description="Place name")],
    limit: Annotated[int, Query(ge=1, le=MAX_RESULTS)] = DEFAULT_RESULTS,
    kind: Annotated[PlaceKind | None, Query(description="Restrict to a place type")] = None,
) -> PlaceSearchResponse:
    places = await service.search(q, limit=limit, kind=kind)
    return PlaceSearchResponse(
        query=q.strip(),
        provider=service.provider,
        results=[PlaceModel(**place.as_dict()) for place in places],
    )


@router.get("/places/providers")
async def providers(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    """Which geocoder is active, and whether it is usable.

    Reported without any key so the client can explain an unconfigured backend
    instead of showing an empty result list.
    """
    return GeocodingService(settings).describe()
