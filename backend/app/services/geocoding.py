"""Place search (forward geocoding).

Converge resolves a typed place name to a coordinate through a real geocoder.
The provider is configurable because geocoding services differ in coverage, rate
limits and licensing, and an operator should be able to pick one that fits their
deployment rather than being tied to a single vendor.

Supported providers (set GEOCODING_PROVIDER):
  nominatim   OpenStreetMap Nominatim. No key required, but its usage policy
              requires an identifying User-Agent and at most one request per
              second, so it suits development and low volume. This is the
              default, and it matches the OpenStreetMap data already used for
              maps.
  mapbox      Mapbox Geocoding v6. Needs GEOCODING_API_KEY.
  locationiq  LocationIQ. Needs GEOCODING_API_KEY.

Two rules hold for every provider:

  * A result is never invented. A provider failure is reported as a failure, and
    the client shows the reason rather than an empty list that looks like "no
    such place".
  * A result is never more precise than the discovery grid. Street addresses and
    individual premises are dropped, because the rest of Converge stores a coarse
    area and accepting a precise place would imply a precision the system does
    not keep.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from ..core.config import Settings
from ..core.errors import ProviderUnavailableError, RateLimitedError, ValidationError

logger = logging.getLogger("converge.geocoding")

PlaceKind = Literal["country", "region", "city", "neighbourhood", "other"]

# Kinds a member may search for. Addresses and premises are absent on purpose:
# see the module docstring.
SEARCHABLE_KINDS: tuple[PlaceKind, ...] = (
    "country",
    "region",
    "city",
    "neighbourhood",
    "other",
)

MAX_QUERY_LENGTH = 120
MAX_RESULTS = 8
DEFAULT_RESULTS = 6

DEFAULT_URLS: dict[str, str] = {
    "nominatim": "https://nominatim.openstreetmap.org/search",
    "mapbox": "https://api.mapbox.com/search/geocode/v6/forward",
    "locationiq": "https://us1.locationiq.com/v1/search",
}

# Nominatim asks for at most one request per second. The throttle is shared
# process-wide so several concurrent searches cannot breach it between them.
MIN_INTERVAL_SECONDS: dict[str, float] = {
    "nominatim": 1.1,
    "locationiq": 0.35,
    "mapbox": 0.0,
}

CACHE_TTL_SECONDS = 600
CACHE_MAX_ENTRIES = 256

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

# Nominatim `addresstype` and `type` values reduced to the four kinds Converge
# distinguishes, plus `other` for anything coarser or unclassified.
_NOMINATIM_KINDS: dict[str, PlaceKind] = {
    "country": "country",
    "state": "region",
    "region": "region",
    "province": "region",
    "state_district": "region",
    "county": "region",
    "municipality": "city",
    "city": "city",
    "town": "city",
    "village": "city",
    "hamlet": "city",
    "borough": "neighbourhood",
    "suburb": "neighbourhood",
    "city_district": "neighbourhood",
    "district": "neighbourhood",
    "quarter": "neighbourhood",
    "neighbourhood": "neighbourhood",
}

_MAPBOX_KINDS: dict[str, PlaceKind] = {
    "country": "country",
    "region": "region",
    "place": "city",
    "locality": "city",
    "district": "neighbourhood",
    "neighborhood": "neighbourhood",
}


@dataclass(frozen=True)
class Place:
    """One resolved place.

    The coordinate is the centre of the place, not of the member. It is the
    place's published centre, so it carries no information about who searched.
    """

    label: str
    name: str
    kind: PlaceKind
    latitude: float
    longitude: float
    city: str | None = None
    region: str | None = None
    country: str | None = None
    country_code: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "name": self.name,
            "kind": self.kind,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "city": self.city,
            "region": self.region,
            "country": self.country,
            "country_code": self.country_code,
        }


def normalise_query(raw: str) -> str:
    """Tidy a typed query, and reject one that cannot be searched.

    Control characters are stripped rather than escaped: they have no place in a
    place name, and passing them through to a provider invites trouble for no
    gain. The result is length-checked so a provider is never handed a payload
    that its own limits would reject.
    """
    cleaned = _CONTROL_CHARS.sub(" ", raw)
    cleaned = " ".join(cleaned.split())
    if len(cleaned) < 2:
        raise ValidationError("Enter at least two characters to search for a place.")
    if len(cleaned) > MAX_QUERY_LENGTH:
        raise ValidationError(
            f"Place searches are limited to {MAX_QUERY_LENGTH} characters."
        )
    return cleaned


def normalise_kind(raw: str) -> PlaceKind:
    kind = raw.strip().lower()
    if kind not in SEARCHABLE_KINDS:
        raise ValidationError(
            f"“{raw}” is not a place type Converge searches. "
            f"Supported types: {', '.join(SEARCHABLE_KINDS)}."
        )
    return kind  # type: ignore[return-value]


def _compose_label(
    *,
    name: str,
    city: str | None,
    region: str | None,
    country: str | None,
    kind: PlaceKind,
) -> str:
    """Build a readable label from structured fields.

    The provider's own display string is not used, because it can carry a
    postcode or a street. Those would imply a precision Converge does not store,
    and they are the parts of an address a member did not ask to share.
    """
    parts = [name]
    if city and city.casefold() != name.casefold():
        parts.append(city)
    # A country is already the whole answer, so it needs no region qualifier.
    if kind != "country":
        if region and all(region.casefold() != part.casefold() for part in parts):
            parts.append(region)
    if country and all(country.casefold() != part.casefold() for part in parts):
        parts.append(country)
    return ", ".join(parts)


def _dedupe(places: list[Place]) -> list[Place]:
    """Drop repeated places.

    Geocoders commonly return the same settlement once per administrative
    boundary it belongs to, which reads as noise in a short result list. The
    first entry wins, and the provider orders by importance, so the most
    recognisable match is kept.
    """
    seen: set[tuple[str, str]] = set()
    unique: list[Place] = []
    for place in places:
        # The country name is the more reliable key: a provider may omit the
        # country code on one entry and supply it on another for the same place.
        key = (place.name.casefold(), (place.country or place.country_code or "").casefold())
        if key in seen:
            continue
        seen.add(key)
        unique.append(place)
    return unique


class _ProviderThrottle:
    """Keeps calls to one provider inside its published rate limit."""

    def __init__(self, min_interval: float) -> None:
        self._min_interval = min_interval
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def wait(self) -> None:
        if self._min_interval <= 0:
            return
        async with self._lock:
            elapsed = time.monotonic() - self._last_call
            if elapsed < self._min_interval:
                await asyncio.sleep(self._min_interval - elapsed)
            self._last_call = time.monotonic()


_throttles: dict[str, _ProviderThrottle] = {}
_cache: dict[str, tuple[float, list[Place]]] = {}


def _throttle_for(provider: str) -> _ProviderThrottle:
    if provider not in _throttles:
        _throttles[provider] = _ProviderThrottle(
            MIN_INTERVAL_SECONDS.get(provider, 0.0)
        )
    return _throttles[provider]


def _cache_key(provider: str, query: str) -> str:
    return f"{provider}:{query.casefold()}"


def _cache_get(key: str) -> list[Place] | None:
    entry = _cache.get(key)
    if not entry:
        return None
    stored_at, places = entry
    if time.monotonic() - stored_at > CACHE_TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return places


def _cache_put(key: str, places: list[Place]) -> None:
    if len(_cache) >= CACHE_MAX_ENTRIES:
        # Drop the oldest entry. The cache exists to absorb repeated typing, not
        # to be a store, so a simple eviction is enough.
        oldest = min(_cache.items(), key=lambda item: item[1][0])[0]
        _cache.pop(oldest, None)
    _cache[key] = (time.monotonic(), places)


def clear_cache() -> None:
    """Drop cached lookups. Used by tests and after a configuration change."""
    _cache.clear()


class GeocodingService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def provider(self) -> str:
        return self._settings.geocoding_provider.strip().lower()

    @property
    def enabled(self) -> bool:
        return self._settings.geocoding_enabled

    def unavailable_reason(self) -> str:
        if not self.provider:
            return (
                "Place search is not configured. Set GEOCODING_PROVIDER on the "
                "Converge backend (nominatim needs no key; mapbox and locationiq "
                "also need GEOCODING_API_KEY)."
            )
        return (
            f"GEOCODING_PROVIDER is set to “{self.provider}”, which Converge does "
            "not implement. Supported values: nominatim, mapbox, locationiq."
        )

    def _url(self) -> str:
        configured = self._settings.geocoding_api_url.strip()
        if configured:
            return configured
        return DEFAULT_URLS.get(self.provider, "")

    def _user_agent(self) -> str:
        return (
            self._settings.geocoding_user_agent.strip()
            or "ConvergeApp/0.1 (+https://github.com/zayaanakhan16-lang/Converge)"
        )

    async def search(
        self,
        query: str,
        *,
        limit: int = DEFAULT_RESULTS,
        kind: PlaceKind | None = None,
    ) -> list[Place]:
        if not self.enabled:
            raise ProviderUnavailableError(self.unavailable_reason())

        cleaned = normalise_query(query)
        wanted = max(1, min(limit, MAX_RESULTS))

        cached = _cache_get(_cache_key(self.provider, cleaned))
        if cached is not None:
            return self._filter(cached, kind)[:wanted]

        await _throttle_for(self.provider).wait()

        if self.provider == "nominatim":
            places = await self._nominatim(cleaned)
        elif self.provider == "locationiq":
            places = await self._locationiq(cleaned)
        elif self.provider == "mapbox":
            places = await self._mapbox(cleaned)
        else:
            raise ProviderUnavailableError(self.unavailable_reason())

        _cache_put(_cache_key(self.provider, cleaned), places)
        return self._filter(places, kind)[:wanted]

    @staticmethod
    def _filter(places: list[Place], kind: PlaceKind | None) -> list[Place]:
        if kind is None:
            return places
        return [place for place in places if place.kind == kind]

    async def _get(self, url: str, params: dict[str, Any]) -> Any:
        """Call the provider and return its parsed body.

        Every failure mode is turned into a Converge error carrying a sentence a
        member can act on. The provider's own error body is logged rather than
        returned, because it can echo the API key.
        """
        headers = {"User-Agent": self._user_agent(), "Accept": "application/json"}
        try:
            async with httpx.AsyncClient(
                timeout=self._settings.geocoding_timeout_seconds
            ) as client:
                response = await client.get(url, params=params, headers=headers)
        except httpx.TimeoutException as exc:
            logger.warning("Geocoding timeout for %s: %s", self.provider, exc)
            raise ProviderUnavailableError(
                "The place lookup took too long. Check your connection and try again."
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("Geocoding transport error for %s: %s", self.provider, exc)
            raise ProviderUnavailableError(
                "The place search service could not be reached. Check your connection."
            ) from exc

        if response.status_code == 429:
            raise RateLimitedError(
                "The place search service is rate limiting Converge. Try again shortly."
            )
        if response.status_code in (401, 403):
            logger.error(
                "Geocoding credentials rejected by %s (%s)",
                self.provider,
                response.status_code,
            )
            raise ProviderUnavailableError(
                f"The {self.provider} geocoding provider rejected Converge's credentials. "
                "Check GEOCODING_API_KEY on the backend."
            )
        if response.status_code >= 400:
            logger.warning(
                "Geocoding error from %s: %s %s",
                self.provider,
                response.status_code,
                response.text[:200],
            )
            raise ProviderUnavailableError(
                f"The place search service returned an error ({response.status_code})."
            )

        try:
            return response.json()
        except ValueError as exc:
            raise ProviderUnavailableError(
                "The place search service returned a response Converge could not read."
            ) from exc

    async def _nominatim(self, query: str) -> list[Place]:
        body = await self._get(
            self._url(),
            {
                "q": query,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": MAX_RESULTS,
                # Restrict to populated-place classes; a road or a shop is not a
                # discovery area.
                "featureType": "settlement",
            },
        )
        return self._from_nominatim(body)

    async def _locationiq(self, query: str) -> list[Place]:
        body = await self._get(
            self._url(),
            {
                "key": self._settings.geocoding_api_key,
                "q": query,
                "format": "json",
                "addressdetails": 1,
                "limit": MAX_RESULTS,
                "tag": "place:city,place:town,place:village,place:country,place:state",
            },
        )
        return self._from_nominatim(body)

    def _from_nominatim(self, body: Any) -> list[Place]:
        """Read a Nominatim-shaped payload. LocationIQ uses the same shape."""
        if not isinstance(body, list):
            raise ProviderUnavailableError(
                "The place search service returned a response Converge could not read."
            )
        places: list[Place] = []
        for entry in body:
            if not isinstance(entry, dict):
                continue
            try:
                latitude = float(entry["lat"])
                longitude = float(entry["lon"])
            except (KeyError, TypeError, ValueError):
                continue

            address = entry.get("address") or {}
            addresstype = str(
                entry.get("addresstype") or entry.get("type") or ""
            ).lower()
            kind = _NOMINATIM_KINDS.get(addresstype, "other")
            name = str(entry.get("name") or "").strip()
            if not name:
                continue

            city = (
                address.get("city")
                or address.get("town")
                or address.get("village")
                or address.get("municipality")
            )
            region = address.get("state") or address.get("region")
            country = address.get("country")
            code = address.get("country_code")
            country_code = str(code).upper() if code else None

            places.append(
                Place(
                    label=_compose_label(
                        name=name,
                        city=city,
                        region=region,
                        country=country,
                        kind=kind,
                    ),
                    name=name,
                    kind=kind,
                    latitude=latitude,
                    longitude=longitude,
                    city=city,
                    region=region,
                    country=country,
                    country_code=country_code,
                )
            )
        return _dedupe(places)

    async def _mapbox(self, query: str) -> list[Place]:
        body = await self._get(
            self._url(),
            {
                "q": query,
                "access_token": self._settings.geocoding_api_key,
                "limit": MAX_RESULTS,
                "types": "country,region,place,locality,neighborhood,district",
            },
        )
        if not isinstance(body, dict):
            raise ProviderUnavailableError(
                "The place search service returned a response Converge could not read."
            )
        features = body.get("features") or []
        places: list[Place] = []
        for feature in features:
            place = self._from_mapbox_feature(feature)
            if place is not None:
                places.append(place)
        return places

    @staticmethod
    def _from_mapbox_feature(feature: Any) -> Place | None:
        if not isinstance(feature, dict):
            return None
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) < 2:
            return None
        try:
            longitude = float(coordinates[0])
            latitude = float(coordinates[1])
        except (TypeError, ValueError):
            return None

        name = str(
            properties.get("name") or properties.get("name_preferred") or ""
        ).strip()
        label = str(
            properties.get("full_address")
            or properties.get("place_formatted")
            or name
        ).strip()
        if not name and not label:
            return None

        feature_type = str(properties.get("feature_type") or "").lower()
        kind = _MAPBOX_KINDS.get(feature_type, "other")

        city = region = country = country_code = None
        context = properties.get("context")
        if isinstance(context, dict):
            place_context = context.get("place") or context.get("locality") or {}
            city = place_context.get("name")
            region = (context.get("region") or {}).get("name")
            country_context = context.get("country") or {}
            country = country_context.get("name")
            code = country_context.get("country_code")
            country_code = str(code).upper() if code else None

        return Place(
            label=_compose_label(
                name=name or label,
                city=city,
                region=region,
                country=country,
                kind=kind,
            ),
            name=name or label,
            kind=kind,
            latitude=latitude,
            longitude=longitude,
            city=city,
            region=region,
            country=country,
            country_code=country_code,
        )

    def describe(self) -> dict[str, Any]:
        """Configuration summary for the health endpoint. Holds no secrets."""
        return {
            "enabled": self.enabled,
            "provider": self.provider or None,
            "kinds": list(SEARCHABLE_KINDS),
        }
