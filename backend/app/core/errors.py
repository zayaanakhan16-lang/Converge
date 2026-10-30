"""Error types and the exception handlers that turn them into responses.

Errors never leak internals: the client receives a stable code and a message
written for a person, and the detail stays in the server log.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("converge")


class ConvergeError(Exception):
    """Base class for errors the API reports deliberately."""

    status_code = 400
    code = "converge-error"

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class ValidationError(ConvergeError):
    status_code = 422
    code = "validation"


class NotPermittedError(ConvergeError):
    status_code = 403
    code = "not-permitted"


class NotAuthenticatedError(ConvergeError):
    status_code = 401
    code = "not-authenticated"


class NotFoundError(ConvergeError):
    status_code = 404
    code = "not-found"


class RateLimitedError(ConvergeError):
    status_code = 429
    code = "rate-limited"


class ProviderUnavailableError(ConvergeError):
    """Raised when a feature needs a provider that is not configured.

    This is deliberately distinct from a provider failure: an unconfigured
    feature is a documented state, and the client shows the reason verbatim
    instead of a fabricated result.
    """

    status_code = 503
    code = "provider-unavailable"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ConvergeError)
    async def handle_converge_error(_: Request, exc: ConvergeError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.error("%s: %s", exc.code, exc.message, exc_info=exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal",
                    "message": "The Converge service hit an unexpected problem. Nothing was changed.",
                }
            },
        )
