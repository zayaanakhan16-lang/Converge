"""Geocoding tests.

The network boundary is the only thing stubbed. Everything that Converge owns —
query validation, kind mapping, label composition, deduplication, caching,
throttling and error translation — runs for real, and the provider payloads are
the shapes Nominatim, LocationIQ and Mapbox actually return.
"""

from __future__ import annotations

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import ProviderUnavailableError, RateLimitedError, ValidationError
from app.services import geocoding
from app.services.geocoding import (
    GeocodingService,
    Place,
    normalise_kind,
    normalise_query,
)


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "GEOCODING_PROVIDER": "nominatim",
        "GEOCODING_API_KEY": "",
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
def _clear_caches() -> None:
    geocoding.clear_cache()
    geocoding._throttles.clear()


NOMINATIM_BODY = [
    {
        "place_id": 416578528,
        "lat": "53.4424618",
        "lon": "-2.2324547",
        "name": "Manchester",
        "display_name": "Manchester, Greater Manchester, England, M60 2UH, United Kingdom",
        "addresstype": "city",
        "type": "city",
        "address": {
            "city": "Manchester",
            "state": "England",
            "country": "United Kingdom",
            "country_code": "gb",
            "postcode": "M60 2UH",
        },
    },
    {
        # Same settlement under a second administrative boundary: must collapse.
        "place_id": 1,
        "lat": "53.4794892",
        "lon": "-2.2451148",
        "name": "Manchester",
        "display_name": "Manchester, Lancashire, England, United Kingdom",
        "addresstype": "city",
        "address": {"city": "Manchester", "state": "England", "country": "United Kingdom"},
    },
    {
        "place_id": 2,
        "lat": "42.9956397",
        "lon": "-71.4547891",
        "name": "Manchester",
        "display_name": "Manchester, Hillsborough County, New Hampshire, United States",
        "addresstype": "city",
        "address": {
            "city": "Manchester",
            "state": "New Hampshire",
            "country": "United States",
            "country_code": "us",
        },
    },
    {
        # An unclassified entry maps to `other` rather than being dropped.
        "place_id": 3,
        "lat": "1.5",
        "lon": "2.5",
        "name": "Somewhere",
        "display_name": "Somewhere",
        "type": "administrative",
        "address": {},
    },
    {
        # No coordinate: unreadable, so skipped rather than guessed.
        "place_id": 4,
        "name": "Broken",
        "display_name": "Broken",
        "address": {},
    },
]


def stub_transport(monkeypatch: pytest.MonkeyPatch, handler) -> list[httpx.Request]:
    """Route the service's HTTP calls to `handler` and record what it sent."""
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    transport = httpx.MockTransport(wrapped)
    original = httpx.AsyncClient

    def client_factory(*args: object, **kwargs: object) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return original(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(geocoding.httpx, "AsyncClient", client_factory)
    return seen


# --------------------------------------------------------------------------- #
# Query handling
# --------------------------------------------------------------------------- #


def test_query_is_tidied_but_not_altered() -> None:
    assert normalise_query("  São   Paulo ") == "São Paulo"
    assert normalise_query("New\u0000York") == "New York"


def test_short_and_overlong_queries_are_rejected() -> None:
    with pytest.raises(ValidationError):
        normalise_query("x")
    with pytest.raises(ValidationError):
        normalise_query("y" * 200)


def test_kind_validation() -> None:
    assert normalise_kind("City") == "city"
    with pytest.raises(ValidationError):
        normalise_kind("street")


# --------------------------------------------------------------------------- #
# Provider parsing
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_nominatim_results_are_parsed_and_deduplicated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(200, json=NOMINATIM_BODY))
    service = GeocodingService(make_settings())

    places = await service.search("Manchester")

    # Two Manchesters survive (GB and US); the duplicate GB boundary is gone.
    assert [place.name for place in places] == ["Manchester", "Manchester", "Somewhere"]
    assert [place.country_code for place in places] == ["GB", "US", None]
    assert places[0].latitude == pytest.approx(53.4424618)


def test_labels_carry_no_postcode_or_street() -> None:
    """A label must not be finer than the discovery grid."""
    from app.services.geocoding import _compose_label

    label = _compose_label(
        name="Manchester",
        city="Manchester",
        region="England",
        country="United Kingdom",
        kind="city",
    )
    assert label == "Manchester, England, United Kingdom"
    assert "M60" not in label

    # A country does not repeat itself, and needs no region qualifier.
    assert (
        _compose_label(
            name="Kenya", city=None, region="Nairobi", country="Kenya", kind="country"
        )
        == "Kenya"
    )


@pytest.mark.asyncio
async def test_kind_filter_keeps_only_matching_places(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(200, json=NOMINATIM_BODY))
    service = GeocodingService(make_settings())

    places = await service.search("Manchester", kind="city")

    assert places
    assert all(place.kind == "city" for place in places)


@pytest.mark.asyncio
async def test_an_empty_provider_answer_is_an_empty_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A genuine "nothing matched" is not an error."""
    stub_transport(monkeypatch, lambda _: httpx.Response(200, json=[]))
    service = GeocodingService(make_settings())

    assert await service.search("asdkjhasdjkhasd") == []


@pytest.mark.asyncio
async def test_the_request_carries_an_identifying_user_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nominatim's usage policy requires this, so it is asserted, not assumed."""
    seen = stub_transport(monkeypatch, lambda _: httpx.Response(200, json=[]))
    service = GeocodingService(make_settings())

    await service.search("Manchester")

    assert seen
    assert "Converge" in seen[0].headers["user-agent"]


@pytest.mark.asyncio
async def test_settlement_feature_type_is_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen = stub_transport(monkeypatch, lambda _: httpx.Response(200, json=[]))
    service = GeocodingService(make_settings())

    await service.search("Manchester")

    assert seen[0].url.params["featureType"] == "settlement"


# --------------------------------------------------------------------------- #
# Failure handling
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_an_unconfigured_provider_reports_the_reason() -> None:
    service = GeocodingService(make_settings(GEOCODING_PROVIDER=""))

    assert service.enabled is False
    with pytest.raises(ProviderUnavailableError) as excinfo:
        await service.search("Manchester")
    assert "GEOCODING_PROVIDER" in str(excinfo.value)


@pytest.mark.asyncio
async def test_a_keyed_provider_without_a_key_is_unavailable() -> None:
    service = GeocodingService(make_settings(GEOCODING_PROVIDER="mapbox"))

    assert service.enabled is False
    with pytest.raises(ProviderUnavailableError):
        await service.search("Manchester")


@pytest.mark.asyncio
async def test_an_unknown_provider_is_named_in_the_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(200, json=[]))
    service = GeocodingService(
        make_settings(GEOCODING_PROVIDER="somewhere-else", GEOCODING_API_KEY="k")
    )

    with pytest.raises(ProviderUnavailableError) as excinfo:
        await service.search("Manchester")
    assert "somewhere-else" in str(excinfo.value)


@pytest.mark.asyncio
async def test_a_timeout_is_reported_as_unavailable_not_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    stub_transport(monkeypatch, handler)
    service = GeocodingService(make_settings())

    with pytest.raises(ProviderUnavailableError) as excinfo:
        await service.search("Manchester")
    assert "too long" in str(excinfo.value)


@pytest.mark.asyncio
async def test_a_transport_error_is_reported_as_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route", request=request)

    stub_transport(monkeypatch, handler)
    service = GeocodingService(make_settings())

    with pytest.raises(ProviderUnavailableError):
        await service.search("Manchester")


@pytest.mark.asyncio
async def test_provider_rate_limiting_is_surfaced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(429, json={}))
    service = GeocodingService(make_settings())

    with pytest.raises(RateLimitedError):
        await service.search("Manchester")


@pytest.mark.asyncio
async def test_rejected_credentials_name_the_setting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(403, json={}))
    service = GeocodingService(make_settings(GEOCODING_PROVIDER="mapbox", GEOCODING_API_KEY="bad"))

    with pytest.raises(ProviderUnavailableError) as excinfo:
        await service.search("Manchester")
    assert "GEOCODING_API_KEY" in str(excinfo.value)


@pytest.mark.asyncio
async def test_an_unreadable_body_is_reported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(200, text="<html>not json"))
    service = GeocodingService(make_settings())

    with pytest.raises(ProviderUnavailableError):
        await service.search("Manchester")


@pytest.mark.asyncio
async def test_a_payload_of_the_wrong_shape_is_reported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_transport(monkeypatch, lambda _: httpx.Response(200, json={"unexpected": True}))
    service = GeocodingService(make_settings())

    with pytest.raises(ProviderUnavailableError):
        await service.search("Manchester")


# --------------------------------------------------------------------------- #
# Caching and throttling
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_repeated_searches_hit_the_provider_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen = stub_transport(monkeypatch, lambda _: httpx.Response(200, json=NOMINATIM_BODY))
    service = GeocodingService(make_settings())

    first = await service.search("Manchester")
    second = await service.search("manchester")

    assert len(seen) == 1, "the second search should have been served from cache"
    assert [p.name for p in first] == [p.name for p in second]


@pytest.mark.asyncio
async def test_a_provider_failure_is_not_cached(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    def handler(_: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(500, text="boom")
        return httpx.Response(200, json=NOMINATIM_BODY)

    stub_transport(monkeypatch, handler)
    service = GeocodingService(make_settings())

    with pytest.raises(ProviderUnavailableError):
        await service.search("Manchester")
    places = await service.search("Manchester")

    assert calls["n"] == 2
    assert places


@pytest.mark.asyncio
async def test_the_nominatim_throttle_spaces_calls_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two different queries must not reach Nominatim back to back."""
    monkeypatch.setattr(geocoding, "MIN_INTERVAL_SECONDS", {"nominatim": 0.25})
    seen = stub_transport(monkeypatch, lambda _: httpx.Response(200, json=[]))
    service = GeocodingService(make_settings())

    started = geocoding.time.monotonic()
    await service.search("Manchester")
    await service.search("Bristol")
    elapsed = geocoding.time.monotonic() - started

    assert len(seen) == 2
    assert elapsed >= 0.25


def test_places_serialise_without_extra_fields() -> None:
    place = Place(
        label="Lagos, Nigeria",
        name="Lagos",
        kind="city",
        latitude=6.45,
        longitude=3.39,
        city="Lagos",
        country="Nigeria",
        country_code="NG",
    )
    assert set(place.as_dict()) == {
        "label",
        "name",
        "kind",
        "latitude",
        "longitude",
        "city",
        "region",
        "country",
        "country_code",
    }
