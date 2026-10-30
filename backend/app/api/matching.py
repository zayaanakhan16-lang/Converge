"""AuraMatch endpoints.

The client sends the viewer and the candidates it is allowed to see. The
backend does the scoring so the weighting stays in one place and can be tuned
without shipping a new app build. Authorisation is unchanged: the client still
only sends profiles it is permitted to read, and RLS enforces that at source.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..api.dependencies import rate_limited
from ..schemas.requests import (
    MatchProfileModel,
    MatchRequest,
    MatchResponse,
    MatchResultModel,
)
from ..services.matching import MINIMUM_MATCH_SCORE, Candidate, rank_matches

router = APIRouter(tags=["matching"], dependencies=[Depends(rate_limited)])


def _to_candidate(model: MatchProfileModel) -> Candidate:
    return Candidate(
        id=model.id,
        display_name=model.display_name,
        interests=tuple(model.interests),
        skills=tuple(model.skills),
        learning_skills=tuple(model.learning_skills),
        languages=tuple(model.languages) or ("en",),
        goals=tuple(model.goals),
        preferred_activities=tuple(model.preferred_activities),
        community_ids=tuple(model.community_ids),
        area_label=model.area_label,
        latitude=model.latitude,
        longitude=model.longitude,
        shares_approximate_location=model.shares_approximate_location,
        visibility=model.visibility,
    )


@router.post("/match", response_model=MatchResponse)
async def match(payload: MatchRequest) -> MatchResponse:
    viewer = _to_candidate(payload.viewer)
    candidates = [_to_candidate(item) for item in payload.candidates]
    outcomes = rank_matches(viewer, candidates)
    return MatchResponse(
        results=[
            MatchResultModel(
                profile_id=outcome.candidate.id,
                score=outcome.score,
                reasons=[
                    {"kind": reason.kind, "detail": reason.detail} for reason in outcome.reasons
                ],
                shared_interests=outcome.shared_interests,
                shared_goals=outcome.shared_goals,
                shared_activities=outcome.shared_activities,
                shared_communities=outcome.shared_communities,
                shared_languages=outcome.shared_languages,
            )
            for outcome in outcomes
        ],
        minimum_score=MINIMUM_MATCH_SCORE,
    )
