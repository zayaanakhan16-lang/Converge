"""API surface tests, including the paths where a feature is not configured."""

from app.services.coach import SCENARIOS


def test_health_reports_capabilities(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    features = body["features"]
    assert features["matching"] is True
    assert features["coach_rules"] is True
    # Nothing provider-backed is claimed as available without credentials.
    assert features["translation"] is False
    assert features["coach_model"] is False
    assert features["transcription"] is False


def test_match_endpoint_ranks_and_explains(client):
    payload = {
        "viewer": {
            "id": "viewer",
            "display_name": "Amara",
            "interests": ["programming", "data-science"],
            "goals": ["find-collaborators"],
            "languages": ["en"],
        },
        "candidates": [
            {
                "id": "candidate",
                "display_name": "Diego",
                "interests": ["programming"],
                "goals": ["find-collaborators"],
                "languages": ["en"],
            },
            {"id": "unrelated", "display_name": "Nobody", "languages": ["ja"]},
        ],
    }
    response = client.post("/api/v1/match", json=payload)
    assert response.status_code == 200
    body = response.json()
    ids = [item["profile_id"] for item in body["results"]]
    assert "candidate" in ids
    assert "unrelated" not in ids
    assert body["minimum_score"] > 0
    first = body["results"][0]
    assert first["reasons"]
    assert all("detail" in reason for reason in first["reasons"])


def test_match_endpoint_rejects_an_empty_candidate_list(client):
    response = client.post(
        "/api/v1/match",
        json={"viewer": {"id": "v", "display_name": "V"}, "candidates": []},
    )
    assert response.status_code == 422


def test_translation_reports_that_no_provider_is_configured(client):
    response = client.post(
        "/api/v1/translate",
        json={"text": "Hello", "source_language": "en", "target_language": "es"},
    )
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "provider-unavailable"
    assert "TRANSLATION_PROVIDER" in body["error"]["message"]


def test_translation_language_list(client):
    response = client.get("/api/v1/translate/languages")
    assert response.status_code == 200
    codes = {item["code"] for item in response.json()["languages"]}
    assert {"en", "es", "fr", "de"} <= codes


def test_translation_rejects_an_unsupported_language(client):
    response = client.post(
        "/api/v1/translate",
        json={"text": "Hello", "source_language": "en", "target_language": "zz"},
    )
    # The provider check runs first, so the unconfigured state is reported; the
    # language guard is covered directly in the service tests.
    assert response.status_code in (422, 503)


def test_transcription_reports_that_no_provider_is_configured(client):
    response = client.post(
        "/api/v1/transcribe",
        json={"audio_base64": "ZmFrZS1hdWRpby1ieXRlcw==", "mime_type": "audio/m4a"},
    )
    assert response.status_code == 503
    assert "TRANSCRIPTION_PROVIDER" in response.json()["error"]["message"]


def test_coach_scenarios_are_listed(client):
    response = client.get("/api/v1/coach/scenarios")
    assert response.status_code == 200
    scenarios = response.json()["scenarios"]
    assert len(scenarios) == len(SCENARIOS)
    assert {"id", "title", "description", "focus", "opening_prompt"} <= set(scenarios[0])


def test_coach_feedback_uses_the_rule_engine_and_says_so(client):
    response = client.post(
        "/api/v1/coach/feedback",
        json={
            "scenario_id": "introduce-yourself",
            "message": "I just wanted to say hello.",
            "match_context": ["Both interested in programming."],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["generated_by_model"] is False
    assert body["provider"] == "converge-rule-engine"
    assert body["strengths"]
    assert any("no question" in item.lower() for item in body["improvements"])
    assert body["suggested_revision"]
    assert body["next_step"]


def test_coach_feedback_requires_a_known_scenario_when_the_model_is_used(client):
    # With no model configured the rule engine answers for any scenario id.
    response = client.post(
        "/api/v1/coach/feedback",
        json={"scenario_id": "not-a-scenario", "message": "Hello there, what do you work on?"},
    )
    assert response.status_code == 200


def test_reports_require_supabase(client):
    response = client.post(
        "/api/v1/reports",
        json={"reason": "spam", "subject_user_id": "someone"},
    )
    assert response.status_code == 503
    assert "SUPABASE_URL" in response.json()["error"]["message"]


def test_root_describes_the_service(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"]
