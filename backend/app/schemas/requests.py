"""Request schemas.

Field limits mirror `mobile/src/utils/validation.ts` and the database check
constraints, so a value that the app refuses is also refused here.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

MAX_MESSAGE_LENGTH = 2000
MAX_REPORT_DETAIL_LENGTH = 600
MAX_COACH_MESSAGE_LENGTH = 600

ReportReason = Literal[
    "harassment",
    "spam",
    "impersonation",
    "inappropriate-content",
    "safety-concern",
    "other",
]


class _Stripped(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def _strip_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TranslateRequest(_Stripped):
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    source_language: str = Field(min_length=2, max_length=8)
    target_language: str = Field(min_length=2, max_length=8)


class TranslateResponse(BaseModel):
    text: str
    provider: str
    was_translated: bool
    source_language: str
    target_language: str


class CoachFeedbackRequest(_Stripped):
    scenario_id: str = Field(min_length=2, max_length=64)
    message: str = Field(min_length=1, max_length=MAX_COACH_MESSAGE_LENGTH)
    match_context: list[str] = Field(default_factory=list, max_length=10)
    target_language: str | None = Field(default=None, max_length=8)


class CoachFeedbackResponse(BaseModel):
    strengths: list[str]
    improvements: list[str]
    suggested_revision: str
    next_step: str
    generated_by_model: bool
    provider: str


class TranscribeRequest(BaseModel):
    audio_base64: str = Field(min_length=16)
    mime_type: str = Field(default="audio/m4a", max_length=64)
    language_hint: str | None = Field(default=None, max_length=8)


class TranscribeResponse(BaseModel):
    text: str
    provider: str
    language: str | None
    confidence: float | None


class ReportRequest(_Stripped):
    subject_user_id: str | None = Field(default=None, max_length=64)
    subject_message_id: str | None = Field(default=None, max_length=64)
    reason: ReportReason
    detail: str | None = Field(default=None, max_length=MAX_REPORT_DETAIL_LENGTH)


class ReportResponse(BaseModel):
    id: str
    status: Literal["open", "reviewing", "actioned", "dismissed"]


class MatchReasonModel(BaseModel):
    kind: Literal[
        "shared-interest",
        "complementary-skill",
        "shared-goal",
        "language-compatibility",
        "shared-activity",
        "shared-community",
        "proximity",
    ]
    detail: str


class MatchProfileModel(BaseModel):
    id: str
    display_name: str
    headline: str | None = None
    interests: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    learning_skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    preferred_activities: list[str] = Field(default_factory=list)
    community_ids: list[str] = Field(default_factory=list)
    area_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    shares_approximate_location: bool = False
    visibility: Literal["community", "discoverable", "private"] = "community"


class MatchRequest(BaseModel):
    viewer: MatchProfileModel
    candidates: list[MatchProfileModel] = Field(min_length=1, max_length=500)


class MatchResultModel(BaseModel):
    profile_id: str
    score: float
    reasons: list[MatchReasonModel]
    shared_interests: list[str]
    shared_goals: list[str]
    shared_activities: list[str]
    shared_communities: list[str]
    shared_languages: list[str]


class MatchResponse(BaseModel):
    results: list[MatchResultModel]
    minimum_score: float


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    features: dict[str, bool]
