"""Converge API application.

A small, explicit service: matching, translation, conversation coaching and
moderation intake. Everything else in Converge runs on Supabase (auth, Postgres,
Realtime, Storage) and the React Native client.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import coach, health, language, matching, moderation, places
from .core.config import get_settings
from .core.errors import register_exception_handlers

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Converge backend intelligence services: AuraMatch scoring, language "
        "translation, place search, conversation coaching and moderation intake."
    ),
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Origins are explicit rather than "*": the app is the only intended caller.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Converge-Client"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(matching.router, prefix="/api/v1")
app.include_router(language.router, prefix="/api/v1")
app.include_router(coach.router, prefix="/api/v1")
app.include_router(moderation.router, prefix="/api/v1")
app.include_router(places.router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "health": "/health",
    }
