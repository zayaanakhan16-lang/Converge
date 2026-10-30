"""Conversation coach endpoints.

Feedback always comes back with `generated_by_model` and `provider` set, so the
app can label rule-based guidance honestly instead of implying a model wrote it.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..api.dependencies import rate_limited
from ..core.config import Settings, get_settings
from ..schemas.requests import CoachFeedbackRequest, CoachFeedbackResponse
from ..services.coach import SCENARIOS, CoachService

router = APIRouter(tags=["coach"], dependencies=[Depends(rate_limited)])


def _service(settings: Annotated[Settings, Depends(get_settings)]) -> CoachService:
    return CoachService(settings)


@router.get("/coach/scenarios")
async def scenarios() -> dict[str, object]:
    return {"scenarios": SCENARIOS}


@router.post("/coach/feedback", response_model=CoachFeedbackResponse)
async def feedback(
    payload: CoachFeedbackRequest,
    service: Annotated[CoachService, Depends(_service)],
) -> CoachFeedbackResponse:
    result = await service.coach(
        scenario_id=payload.scenario_id,
        message=payload.message,
        match_context=payload.match_context,
    )
    return CoachFeedbackResponse(
        strengths=result.strengths,
        improvements=result.improvements,
        suggested_revision=result.suggested_revision,
        next_step=result.next_step,
        generated_by_model=result.generated_by_model,
        provider=result.provider,
    )
