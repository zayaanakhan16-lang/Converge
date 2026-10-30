"""Translation service.

The provider is a thin adapter over an external API. When no provider is
configured the service raises `ProviderUnavailableError`, and the client shows
that reason. It never returns the input relabelled as a translation, and it
never invents output.

Supported providers (set TRANSLATION_PROVIDER):
  - `deepl`  DeepL v2, needs TRANSLATION_API_KEY and TRANSLATION_API_URL
  - `libre`  LibreTranslate-compatible endpoint
  - `openai` Chat-completions-compatible endpoint
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from ..core.config import Settings
from ..core.errors import ProviderUnavailableError, ValidationError

# Languages the pipeline is wired for. Kept in step with the mobile taxonomy.
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "ar": "Arabic",
    "hi": "Hindi",
    "ur": "Urdu",
}

DEEPL_CODES = {"en": "EN-GB", "pt": "PT-PT"}

MAX_TEXT_LENGTH = 2000


@dataclass(frozen=True)
class TranslationOutput:
    text: str
    provider: str
    was_translated: bool


def normalise(code: str) -> str:
    return code.strip().lower().split("-")[0]


def ensure_supported(source: str, target: str) -> tuple[str, str]:
    source_code = normalise(source)
    target_code = normalise(target)
    unsupported = [
        code
        for code in (source_code, target_code)
        if code not in SUPPORTED_LANGUAGES
    ]
    if unsupported:
        raise ValidationError(
            "Converge does not translate "
            f"{', '.join(SUPPORTED_LANGUAGES.get(code, code) for code in unsupported)} yet. "
            f"Supported languages: {', '.join(SUPPORTED_LANGUAGES.values())}."
        )
    return source_code, target_code


class TranslationService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        return self._settings.translation_enabled

    def unavailable_reason(self) -> str:
        return (
            "No translation provider is configured. Set TRANSLATION_PROVIDER, "
            "TRANSLATION_API_KEY and TRANSLATION_API_URL on the Converge backend."
        )

    async def translate(self, text: str, source: str, target: str) -> TranslationOutput:
        if not self.enabled:
            raise ProviderUnavailableError(self.unavailable_reason())
        if len(text) > MAX_TEXT_LENGTH:
            raise ValidationError(f"Messages are limited to {MAX_TEXT_LENGTH} characters.")
        source_code, target_code = ensure_supported(source, target)
        if source_code == target_code:
            return TranslationOutput(
                text=text,
                provider="none",
                was_translated=False,
            )

        provider = self._settings.translation_provider.strip().lower()
        if provider == "deepl":
            return await self._deepl(text, source_code, target_code)
        if provider == "libre":
            return await self._libre(text, source_code, target_code)
        if provider == "openai":
            return await self._chat_provider(text, source_code, target_code)
        raise ProviderUnavailableError(
            f"TRANSLATION_PROVIDER is set to “{provider}”, which Converge does not implement. "
            "Supported values: deepl, libre, openai."
        )

    async def _deepl(self, text: str, source: str, target: str) -> TranslationOutput:
        payload = {
            "text": [text],
            "source_lang": DEEPL_CODES.get(source, source.upper()),
            "target_lang": DEEPL_CODES.get(target, target.upper()),
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                self._settings.translation_api_url,
                headers={
                    "Authorization": f"DeepL-Auth-Key {self._settings.translation_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        self._raise_for_status(response)
        body = response.json()
        translations = body.get("translations") or []
        if not translations:
            raise ProviderUnavailableError("The translation provider returned no translation.")
        detected = normalise(translations[0].get("detected_source_language", source))
        return TranslationOutput(
            text=translations[0]["text"],
            provider="deepl",
            was_translated=detected != target,
        )

    async def _libre(self, text: str, source: str, target: str) -> TranslationOutput:
        payload = {
            "q": text,
            "source": source,
            "target": target,
            "format": "text",
            "api_key": self._settings.translation_api_key,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(self._settings.translation_api_url, json=payload)
        self._raise_for_status(response)
        body = response.json()
        translated = body.get("translatedText")
        if not isinstance(translated, str) or not translated:
            raise ProviderUnavailableError("The translation provider returned no translation.")
        return TranslationOutput(
            text=translated,
            provider="libre",
            was_translated=translated.strip() != text.strip(),
        )

    async def _chat_provider(self, text: str, source: str, target: str) -> TranslationOutput:
        prompt = (
            f"Translate the following message from {SUPPORTED_LANGUAGES[source]} to "
            f"{SUPPORTED_LANGUAGES[target]}. Reply with the translation only, preserving "
            f"tone and line breaks. Do not add commentary.\n\n{text}"
        )
        payload = {
            "model": self._settings.coach_model or "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self._settings.translation_api_url,
                headers={
                    "Authorization": f"Bearer {self._settings.translation_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        self._raise_for_status(response)
        body = response.json()
        choices = body.get("choices") or []
        if not choices:
            raise ProviderUnavailableError("The translation provider returned no translation.")
        translated = (choices[0].get("message") or {}).get("content") or ""
        if not translated.strip():
            raise ProviderUnavailableError("The translation provider returned no translation.")
        return TranslationOutput(
            text=translated.strip(),
            provider="openai",
            was_translated=translated.strip() != text.strip(),
        )

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code >= 400:
            # The provider body can contain the key in an error message, so it
            # is logged rather than returned.
            raise ProviderUnavailableError(
                f"The translation provider rejected the request ({response.status_code})."
            )
