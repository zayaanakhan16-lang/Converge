"""AuraMatch scoring, mirrored from the mobile engine.

The backend is authoritative when it is reachable: it can see every candidate
and every community membership in one pass, which the client cannot. The
TypeScript engine in `mobile/src/features/matching/engine.ts` implements the
same weights so the app behaves identically offline.

Every result carries the reasons that produced it. The score is a weighted sum
and is never presented to a member as a percentage.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

MATCH_WEIGHTS = {
    "shared_interest": 1.0,
    "complementary_skill": 1.5,
    "shared_goal": 1.8,
    "language_compatibility": 1.2,
    "shared_activity": 0.8,
    "shared_community": 1.3,
    "proximity": 0.6,
}

MINIMUM_MATCH_SCORE = 1.6

PROXIMITY_FULL_SCORE_KM = 2.0
PROXIMITY_ZERO_SCORE_KM = 25.0

# Human-readable labels. Kept in step with mobile/src/constants/taxonomy.ts.
INTEREST_LABELS: dict[str, str] = {
    "programming": "programming",
    "open-source": "open source",
    "robotics": "robotics",
    "data-science": "data science",
    "cybersecurity": "cybersecurity",
    "game-development": "game development",
    "graphic-design": "graphic design",
    "photography": "photography",
    "film": "film",
    "creative-writing": "creative writing",
    "debate": "debate",
    "mathematics": "mathematics",
    "physics": "physics",
    "history": "history",
    "languages": "languages",
    "basketball": "basketball",
    "football": "football",
    "running": "running",
    "cycling": "cycling",
    "climbing": "climbing",
    "hiking": "hiking",
    "gardening": "gardening",
    "birdwatching": "birdwatching",
    "volunteering": "volunteering",
    "student-societies": "student societies",
    "local-events": "local events",
    "mentoring": "mentoring",
    "woodwork": "woodwork",
    "sewing": "sewing",
    "electronics": "electronics",
    "choir": "choir",
    "guitar": "guitar",
    "music-production": "music production",
    "outdoors": "the outdoors",
    "craft": "craft and making",
}

SKILL_LABELS: dict[str, str] = {
    "frontend": "front-end development",
    "backend": "back-end development",
    "mobile": "mobile development",
    "data-analysis": "data analysis",
    "machine-learning": "machine learning",
    "devops": "devops",
    "ui-design": "UI design",
    "illustration": "illustration",
    "video-editing": "video editing",
    "copywriting": "copywriting",
    "public-speaking": "public speaking",
    "event-planning": "event planning",
    "project-management": "project management",
    "teaching": "teaching",
    "community-organising": "community organising",
    "first-aid": "first aid",
    "cooking": "cooking",
    "repair": "repair and maintenance",
    "sound-engineering": "sound engineering",
    "cybersecurity": "security engineering",
}

GOAL_LABELS: dict[str, str] = {
    "find-collaborators": "find project collaborators",
    "learn-skill": "learn a new skill",
    "practise-language": "practise a language",
    "join-community": "join a community",
    "build-confidence": "build conversation confidence",
    "mentor-others": "mentor others",
    "make-friends": "make new friends",
    "volunteer": "volunteer locally",
}

ACTIVITY_LABELS: dict[str, str] = {
    "study-sessions": "study sessions",
    "hackathons": "hackathons",
    "workshops": "workshops",
    "sports-meetups": "sports meet-ups",
    "walking-groups": "walking groups",
    "book-clubs": "book clubs",
    "volunteer-days": "volunteer days",
    "exhibitions": "exhibitions",
    "open-mics": "open mics",
    "language-exchange": "language exchange",
}

LANGUAGE_LABELS: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "ar": "Arabic",
    "hi": "Hindi",
    "ur": "Urdu",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "sw": "Swahili",
    "tr": "Turkish",
    "ig": "Igbo",
    "ta": "Tamil",
}


@dataclass(frozen=True)
class Candidate:
    """The slice of a profile the engine needs."""

    id: str
    display_name: str
    interests: tuple[str, ...] = ()
    skills: tuple[str, ...] = ()
    learning_skills: tuple[str, ...] = ()
    languages: tuple[str, ...] = ("en",)
    goals: tuple[str, ...] = ()
    preferred_activities: tuple[str, ...] = ()
    community_ids: tuple[str, ...] = ()
    area_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    shares_approximate_location: bool = False
    visibility: str = "community"


@dataclass
class Reason:
    kind: str
    detail: str


@dataclass
class MatchOutcome:
    candidate: Candidate
    score: float
    reasons: list[Reason] = field(default_factory=list)
    shared_interests: list[str] = field(default_factory=list)
    shared_goals: list[str] = field(default_factory=list)
    shared_activities: list[str] = field(default_factory=list)
    shared_communities: list[str] = field(default_factory=list)
    shared_languages: list[str] = field(default_factory=list)


def haversine_km(
    lat_a: float, lon_a: float, lat_b: float, lon_b: float
) -> float:
    radius = 6371.0
    d_lat = math.radians(lat_b - lat_a)
    d_lon = math.radians(lon_b - lon_a)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat_a)) * math.cos(math.radians(lat_b)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _intersection(left: tuple[str, ...], right: tuple[str, ...]) -> list[str]:
    right_set = set(right)
    return [item for item in left if item in right_set]


def _label(table: dict[str, str], key: str) -> str:
    return table.get(key, key.replace("-", " "))


def _complementary_skills(
    viewer: Candidate, candidate: Candidate
) -> tuple[list[str], list[str]]:
    viewer_offers = _intersection(viewer.skills, candidate.learning_skills)
    candidate_offers = _intersection(candidate.skills, viewer.learning_skills)
    matched = list(dict.fromkeys([*viewer_offers, *candidate_offers]))
    return matched, candidate_offers


def _language_signal(viewer: Candidate, candidate: Candidate) -> tuple[float, Reason, list[str]]:
    shared = _intersection(viewer.languages, candidate.languages)
    if shared:
        first = _label(LANGUAGE_LABELS, shared[0])
        detail = (
            f"You both speak {first}."
            if len(shared) == 1
            else f"You share {len(shared)} languages, including {first}."
        )
        return MATCH_WEIGHTS["language_compatibility"], Reason("language-compatibility", detail), shared
    return (
        MATCH_WEIGHTS["language_compatibility"] * 0.4,
        Reason(
            "language-compatibility",
            "You speak different languages, but in-app translation covers both.",
        ),
        [],
    )


def _proximity_signal(viewer: Candidate, candidate: Candidate) -> tuple[float, Reason | None]:
    if not (
        viewer.shares_approximate_location
        and candidate.shares_approximate_location
        and viewer.latitude is not None
        and viewer.longitude is not None
        and candidate.latitude is not None
        and candidate.longitude is not None
    ):
        return 0.0, None
    distance = haversine_km(
        viewer.latitude, viewer.longitude, candidate.latitude, candidate.longitude
    )
    if distance > PROXIMITY_ZERO_SCORE_KM:
        return 0.0, None
    if distance <= PROXIMITY_FULL_SCORE_KM:
        ratio = 1.0
    else:
        ratio = 1 - (distance - PROXIMITY_FULL_SCORE_KM) / (
            PROXIMITY_ZERO_SCORE_KM - PROXIMITY_FULL_SCORE_KM
        )
    area = candidate.area_label or "your area"
    detail = (
        f"Based in {area}, close to you."
        if distance <= PROXIMITY_FULL_SCORE_KM
        else f"Both based around {area}, roughly {round(distance)} km apart."
    )
    return MATCH_WEIGHTS["proximity"] * ratio, Reason("proximity", detail)


def score_match(viewer: Candidate, candidate: Candidate) -> MatchOutcome:
    reasons: list[Reason] = []
    score = 0.0

    shared_interests = _intersection(viewer.interests, candidate.interests)
    if shared_interests:
        score += MATCH_WEIGHTS["shared_interest"] * min(len(shared_interests), 3)
        first = _label(INTEREST_LABELS, shared_interests[0])
        detail = (
            f"Both interested in {first}."
            if len(shared_interests) == 1
            else f"{len(shared_interests)} shared interests, including {first}."
        )
        reasons.append(Reason("shared-interest", detail))

    matched_skills, candidate_helps_with = _complementary_skills(viewer, candidate)
    if matched_skills:
        score += MATCH_WEIGHTS["complementary_skill"] * min(len(matched_skills), 2)
        if candidate_helps_with:
            detail = (
                f"{candidate.display_name} can help with "
                f"{_label(SKILL_LABELS, candidate_helps_with[0])}."
            )
        else:
            detail = (
                f"Your {_label(SKILL_LABELS, matched_skills[0])} matches what they want to learn."
            )
        reasons.append(Reason("complementary-skill", detail))

    shared_goals = _intersection(viewer.goals, candidate.goals)
    if shared_goals:
        score += MATCH_WEIGHTS["shared_goal"] * min(len(shared_goals), 2)
        reasons.append(
            Reason(
                "shared-goal",
                f"You are both looking to {_label(GOAL_LABELS, shared_goals[0])}.",
            )
        )

    language_score, language_reason, shared_languages = _language_signal(viewer, candidate)
    score += language_score
    reasons.append(language_reason)

    shared_activities = _intersection(viewer.preferred_activities, candidate.preferred_activities)
    if shared_activities:
        score += MATCH_WEIGHTS["shared_activity"] * min(len(shared_activities), 2)
        reasons.append(
            Reason(
                "shared-activity",
                f"You both prefer {_label(ACTIVITY_LABELS, shared_activities[0])}.",
            )
        )

    shared_communities = _intersection(viewer.community_ids, candidate.community_ids)
    if shared_communities:
        score += MATCH_WEIGHTS["shared_community"] * min(len(shared_communities), 2)
        reasons.append(
            Reason(
                "shared-community",
                "You are both members of the same community.",
            )
        )

    proximity_score, proximity_reason = _proximity_signal(viewer, candidate)
    score += proximity_score
    if proximity_reason:
        reasons.append(proximity_reason)

    return MatchOutcome(
        candidate=candidate,
        score=round(score, 4),
        reasons=reasons,
        shared_interests=shared_interests,
        shared_goals=shared_goals,
        shared_activities=shared_activities,
        shared_communities=shared_communities,
        shared_languages=shared_languages,
    )


def rank_matches(
    viewer: Candidate,
    candidates: list[Candidate],
    *,
    excluded_ids: set[str] | None = None,
) -> list[MatchOutcome]:
    """Rank candidates, dropping weak matches and anything the viewer excluded.

    Private profiles are skipped here as well as in the client: the backend is
    the last line of defence, not the first.
    """
    excluded = excluded_ids or set()
    outcomes: list[MatchOutcome] = []
    for candidate in candidates:
        if candidate.id == viewer.id or candidate.id in excluded:
            continue
        if candidate.visibility == "private":
            continue
        outcome = score_match(viewer, candidate)
        if outcome.score >= MINIMUM_MATCH_SCORE:
            outcomes.append(outcome)
    outcomes.sort(key=lambda item: (-item.score, item.candidate.display_name))
    return outcomes
