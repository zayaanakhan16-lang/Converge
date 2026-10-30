"""Matching service tests.

The scoring rules are the product's core claim: recommendations must be
explainable and must never expose a private profile.
"""

from app.services.matching import (
    MINIMUM_MATCH_SCORE,
    Candidate,
    haversine_km,
    rank_matches,
    score_match,
)

VIEWER = Candidate(
    id="viewer",
    display_name="Amara",
    interests=("programming", "open-source", "data-science"),
    skills=("frontend", "backend"),
    learning_skills=("machine-learning", "ui-design"),
    languages=("en",),
    goals=("find-collaborators", "build-confidence"),
    preferred_activities=("study-sessions", "hackathons"),
    community_ids=("community-1",),
    latitude=53.49,
    longitude=-2.24,
    shares_approximate_location=True,
)


def test_shared_interest_produces_an_explanation():
    candidate = Candidate(id="c", display_name="Diego", interests=("programming",))
    outcome = score_match(VIEWER, candidate)
    kinds = [reason.kind for reason in outcome.reasons]
    assert "shared-interest" in kinds
    detail = next(r.detail for r in outcome.reasons if r.kind == "shared-interest")
    assert "programming" in detail
    assert outcome.score > 0


def test_complementary_skill_is_directional():
    candidate = Candidate(
        id="c",
        display_name="Diego",
        skills=("ui-design", "machine-learning"),
    )
    outcome = score_match(VIEWER, candidate)
    reason = next((r for r in outcome.reasons if r.kind == "complementary-skill"), None)
    assert reason is not None
    assert "Diego" in reason.detail


def test_shared_skill_alone_is_not_complementary():
    candidate = Candidate(id="c", display_name="Diego", skills=("frontend",))
    outcome = score_match(VIEWER, candidate)
    assert all(reason.kind != "complementary-skill" for reason in outcome.reasons)


def test_shared_goal_outweighs_shared_interest():
    interest_only = score_match(VIEWER, Candidate(id="a", display_name="A", interests=("climbing",)))
    goal_only = score_match(
        VIEWER, Candidate(id="b", display_name="B", goals=("find-collaborators",))
    )
    assert goal_only.score > interest_only.score


def test_proximity_requires_both_sides_to_opt_in():
    near = Candidate(
        id="near",
        display_name="Near",
        latitude=53.49,
        longitude=-2.24,
        shares_approximate_location=True,
    )
    hidden = Candidate(
        id="hidden",
        display_name="Hidden",
        latitude=53.49,
        longitude=-2.24,
        shares_approximate_location=False,
    )
    assert any(r.kind == "proximity" for r in score_match(VIEWER, near).reasons)
    assert not any(r.kind == "proximity" for r in score_match(VIEWER, hidden).reasons)


def test_rank_matches_excludes_self_private_and_weak_candidates():
    strong = Candidate(
        id="strong",
        display_name="Strong",
        interests=("programming", "open-source"),
        goals=("find-collaborators",),
    )
    weak = Candidate(id="weak", display_name="Weak")
    private = Candidate(
        id="private",
        display_name="Private",
        interests=("programming", "open-source"),
        goals=("find-collaborators",),
        visibility="private",
    )
    ranked = rank_matches(VIEWER, [VIEWER, strong, weak, private])
    assert [outcome.candidate.id for outcome in ranked] == ["strong"]
    assert ranked[0].score >= MINIMUM_MATCH_SCORE


def test_rank_matches_honours_exclusions():
    other = Candidate(id="other", display_name="Other", interests=("programming",))
    ranked = rank_matches(VIEWER, [other], excluded_ids={"other"})
    assert ranked == []


def test_shared_community_is_reported():
    peer = Candidate(
        id="peer",
        display_name="Peer",
        community_ids=("community-1",),
    )
    outcome = score_match(VIEWER, peer)
    assert "community-1" in outcome.shared_communities
    assert any(reason.kind == "shared-community" for reason in outcome.reasons)


def test_language_fallback_explains_translation():
    candidate = Candidate(id="c", display_name="C", languages=("de",))
    outcome = score_match(VIEWER, candidate)
    reason = next(r for r in outcome.reasons if r.kind == "language-compatibility")
    assert "translation" in reason.detail


def test_haversine_distance():
    assert haversine_km(53.49, -2.24, 53.49, -2.24) == 0
    distance = haversine_km(53.49, -2.24, 53.39, -2.24)
    assert 10 < distance < 12
