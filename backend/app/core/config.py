"""Backend configuration.

Every value is read from the environment. Nothing here has a default that would
silently enable a paid provider: translation and model coaching stay disabled
until an operator supplies credentials, and the API reports that state honestly.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Converge API"
    version: str = "0.1.0"
    environment: str = Field(default="development", alias="CONVERGE_ENV")

    # ---- Supabase -----------------------------------------------------------
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = Field(default="", alias="SUPABASE_JWT_SECRET")

    # ---- Transport ----------------------------------------------------------
    allowed_origins: str = Field(
        default="http://localhost:8081,http://localhost:19006",
        alias="CONVERGE_ALLOWED_ORIGINS",
    )
    client_token: str = Field(default="", alias="CONVERGE_CLIENT_TOKEN")
    rate_limit_per_minute: int = Field(default=60, alias="CONVERGE_RATE_LIMIT_PER_MINUTE")

    # ---- Translation --------------------------------------------------------
    translation_provider: str = Field(default="", alias="TRANSLATION_PROVIDER")
    translation_api_key: str = Field(default="", alias="TRANSLATION_API_KEY")
    translation_api_url: str = Field(default="", alias="TRANSLATION_API_URL")

    # ---- Conversation coach -------------------------------------------------
    coach_model: str = Field(default="", alias="COACH_MODEL")
    coach_api_key: str = Field(default="", alias="COACH_API_KEY")
    coach_api_url: str = Field(default="", alias="COACH_API_URL")

    # ---- Transcription ------------------------------------------------------
    transcription_provider: str = Field(default="", alias="TRANSCRIPTION_PROVIDER")
    transcription_api_key: str = Field(default="", alias="TRANSCRIPTION_API_KEY")
    transcription_api_url: str = Field(default="", alias="TRANSCRIPTION_API_URL")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def translation_enabled(self) -> bool:
        return bool(self.translation_provider and self.translation_api_key and self.translation_api_url)

    @property
    def coach_model_enabled(self) -> bool:
        return bool(self.coach_model and self.coach_api_key and self.coach_api_url)

    @property
    def transcription_enabled(self) -> bool:
        return bool(
            self.transcription_provider
            and self.transcription_api_key
            and self.transcription_api_url
        )

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    def feature_flags(self) -> dict[str, bool]:
        return {
            "translation": self.translation_enabled,
            "coach_model": self.coach_model_enabled,
            "coach_rules": True,
            "transcription": self.transcription_enabled,
            "matching": True,
            "supabase": self.supabase_enabled,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
