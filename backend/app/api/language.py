"""Translation endpoints.

`/translate` returns a real translation or a 503 explaining that no provider is
configured. `/transcribe` does the same for voice notes. Neither ever returns
the input relabelled as output.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..api.dependencies import rate_limited
from ..core.config import Settings, get_settings
from ..core.errors import ProviderUnavailableError
from ..schemas.requests import (
    TranscribeRequest,
    TranscribeResponse,
    TranslateRequest,
    TranslateResponse,
)
from ..services.translation import SUPPORTED_LANGUAGES, TranslationService

router = APIRouter(tags=["language"], dependencies=[Depends(rate_limited)])


def _service(settings: Annotated[Settings, Depends(get_settings)]) -> TranslationService:
    return TranslationService(settings)


@router.get("/translate/languages")
async def languages() -> dict[str, object]:
    """The languages the pipeline is wired for, with their display names."""
    return {
        "languages": [
            {"code": code, "label": label} for code, label in SUPPORTED_LANGUAGES.items()
        ]
    }


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    payload: TranslateRequest,
    service: Annotated[TranslationService, Depends(_service)],
) -> TranslateResponse:
    output = await service.translate(
        text=payload.text,
        source=payload.source_language,
        target=payload.target_language,
    )
    return TranslateResponse(
        text=output.text,
        provider=output.provider,
        was_translated=output.was_translated,
        source_language=payload.source_language,
        target_language=payload.target_language,
    )


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    payload: TranscribeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> TranscribeResponse:
    if not settings.transcription_enabled:
        raise ProviderUnavailableError(
            "No transcription provider is configured. Set TRANSCRIPTION_PROVIDER, "
            "TRANSCRIPTION_API_KEY and TRANSCRIPTION_API_URL on the Converge backend. "
            "Voice notes are still delivered as audio without a transcript."
        )
    # The adapter is intentionally not implemented against a guessed API shape:
    # returning invented text would be worse than reporting the gap.
    raise ProviderUnavailableError(
        f"TRANSCRIPTION_PROVIDER is set to “{settings.transcription_provider}”, but the "
        "Converge transcription adapter is not implemented for it yet."
    )
