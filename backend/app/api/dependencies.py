"""Request dependencies: rate limiting, client identity and the client token.

The client token is not an authentication mechanism for members — Supabase
issues and verifies their sessions. It exists so a deployment can keep the AI
endpoints from being called by anything that is not the Converge app.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request

from ..core.config import Settings, get_settings
from ..core.errors import NotPermittedError
from ..core.rate_limit import SlidingWindowLimiter

_limiter: SlidingWindowLimiter | None = None


def limiter(settings: Annotated[Settings, Depends(get_settings)]) -> SlidingWindowLimiter:
    global _limiter
    if _limiter is None:
        _limiter = SlidingWindowLimiter(settings.rate_limit_per_minute)
    return _limiter


def client_identity(request: Request) -> str:
    """Identity used for rate limiting.

    Prefers an explicit forwarded address so a reverse proxy does not collapse
    every client into one bucket, and falls back to the socket address.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


async def rate_limited(
    request: Request,
    bucket: Annotated[SlidingWindowLimiter, Depends(limiter)],
) -> None:
    bucket.check(client_identity(request))


async def require_client_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_converge_client: Annotated[str | None, Header(alias="X-Converge-Client")] = None,
) -> None:
    """Guards write endpoints when a token is configured.

    With no token configured the check is skipped: a local development backend
    should not require ceremony. The health endpoint reports whether the guard
    is active so this is never a surprise in production.
    """
    expected = settings.client_token
    if not expected:
        return
    if x_converge_client != expected:
        raise NotPermittedError(
            "This endpoint requires a valid X-Converge-Client header."
        )
