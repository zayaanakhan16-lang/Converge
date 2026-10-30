"""Coach and translation service tests."""

import pytest

from app.core.config import Settings
from app.core.errors import ProviderUnavailableError, ValidationError
from app.services.coach import SCENARIO_BY_ID, CoachService, rule_coach
from app.services.translation import TranslationService, ensure_supported

SCENARIO_IDS = tuple(SCENARIO_BY_ID)


def test_rule_coach_never_claims_a_model():
    result = rule_coach("start-conversation", "Hi, what do you work on?")
    assert result.generated_by_model is False
    assert result.provider == "converge-rule-engine"


def test_rule_coach_quotes_the_filler_it_objects_to():
    result = rule_coach("introduce-yourself", "I just wanted to say hello.")
    improvement = next((item for item in result.improvements if "just wanted to" in item), None)
    assert improvement is not None


def test_rule_coach_removes_filler_from_the_revision():
    result = rule_coach("introduce-yourself", "I just wanted to say hello.")
    assert "just wanted to" not in result.suggested_revision.lower()


def test_rule_coach_adds_a_question_when_one_is_missing():
    result = rule_coach("start-conversation", "I am a computing student.")
    assert "?" in result.suggested_revision
    assert any("no question" in item.lower() for item in result.improvements)


def test_rule_coach_asks_for_an_introduction_when_missing():
    result = rule_coach("introduce-yourself", "What camera do you use?")
    assert any("who you are" in item for item in result.improvements)


def test_rule_coach_flags_an_overlong_first_message():
    long_message = " ".join(["This is a long explanation about my project."] * 30)
    result = rule_coach("start-conversation", long_message)
    assert any("long for a first message" in item for item in result.improvements)


def test_rule_coach_flags_an_over_short_message():
    result = rule_coach("start-conversation", "Hello there")
    assert any("very short" in item for item in result.improvements)


def test_rule_coach_always_returns_something_useful():
    result = rule_coach("express-ideas", "   ")
    assert result.strengths
    assert result.next_step
    assert result.suggested_revision


@pytest.mark.anyio
async def test_coach_service_falls_back_to_rules_without_a_model():
    service = CoachService(Settings())
    result = await service.coach("ask-a-question", "Can you help me with React?")
    assert result.generated_by_model is False
    assert service.model_enabled is False
    assert "COACH_MODEL" in service.unavailable_reason()


def test_translation_service_reports_unconfigured_state():
    service = TranslationService(Settings())
    assert service.enabled is False
    assert "TRANSLATION_PROVIDER" in service.unavailable_reason()


@pytest.mark.anyio
async def test_translation_refuses_to_work_without_a_provider():
    service = TranslationService(Settings())
    with pytest.raises(ProviderUnavailableError):
        await service.translate("Hello", "en", "es")


def test_supported_language_guard():
    assert ensure_supported("en", "es") == ("en", "es")
    assert ensure_supported("EN-gb", "ES") == ("en", "es")
    with pytest.raises(ValidationError):
        ensure_supported("en", "zz")


@pytest.mark.anyio
async def test_translation_returns_input_unchanged_for_the_same_language():
    settings = Settings(
        TRANSLATION_PROVIDER="deepl",
        TRANSLATION_API_KEY="test-key",
        TRANSLATION_API_URL="https://example.invalid/translate",
    )
    service = TranslationService(settings)
    assert service.enabled is True
    output = await service.translate("Hello", "en", "en")
    assert output.text == "Hello"
    assert output.was_translated is False
    assert output.provider == "none"
