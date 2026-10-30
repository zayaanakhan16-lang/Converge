"""Conversation coach.

Two implementations sit behind one interface:

  * `CoachService.coach` calls a configured model and asks for strict JSON.
  * `rule_coach` is a deterministic analyser that runs with no model at all.

The rule engine is not a stub: it applies named rules to the submitted text and
quotes the exact phrase it objects to. When the model is unreachable the API
falls back to it and says so in the response, so a member always knows what
produced their feedback.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx

from ..core.config import Settings
from ..core.errors import ProviderUnavailableError

MAX_MESSAGE_LENGTH = 600

SCENARIOS: list[dict[str, str]] = [
    {
        "id": "introduce-yourself",
        "title": "Introduce yourself",
        "description": "Write an opening that gives the other person something to reply to.",
        "focus": "Introducing yourself",
        "opening_prompt": (
            "Write the first message you would send to someone you were matched with "
            "because you both like photography."
        ),
    },
    {
        "id": "start-conversation",
        "title": "Start a conversation",
        "description": "Open a conversation with someone you have never spoken to before.",
        "focus": "Starting conversations",
        "opening_prompt": (
            "Write a message that opens a conversation with a member of a community you just joined."
        ),
    },
    {
        "id": "network-at-event",
        "title": "Network at an event",
        "description": "Introduce yourself at a workshop or meet-up without sounding rehearsed.",
        "focus": "Networking at events",
        "opening_prompt": (
            "You are at a public workshop on data science. Write what you would say to "
            "someone standing next to you."
        ),
    },
    {
        "id": "ask-a-question",
        "title": "Ask a useful question",
        "description": "Ask for help in a way that makes it easy for someone to say yes.",
        "focus": "Asking questions",
        "opening_prompt": (
            "You want help learning React from someone whose profile says they build "
            "front-end projects. Write the question."
        ),
    },
    {
        "id": "join-group-discussion",
        "title": "Join a group discussion",
        "description": "Add something useful to a discussion that is already underway.",
        "focus": "Joining group discussions",
        "opening_prompt": (
            "A community discussion is about how to run a first hackathon. Write your contribution."
        ),
    },
    {
        "id": "express-ideas",
        "title": "Express an idea confidently",
        "description": "State an opinion or proposal without over-qualifying it.",
        "focus": "Expressing ideas confidently",
        "opening_prompt": (
            "Propose a project idea to a potential collaborator. Write it as you would send it."
        ),
    },
]

SCENARIO_BY_ID = {scenario["id"]: scenario for scenario in SCENARIOS}

FOLLOW_UP_QUESTIONS: dict[str, str] = {
    "introduce-yourself": "Would you be up for comparing notes on it some time?",
    "start-conversation": "What got you into it originally?",
    "network-at-event": "What are you hoping to get out of today?",
    "ask-a-question": "Would you be open to pointing me at one thing to try first?",
    "join-group-discussion": "How did you handle the sign-up side of it?",
    "express-ideas": "Would that be something you would want to work on together?",
}

FILLER_PHRASES = (
    "just wanted to",
    "sorry to bother",
    "i know this is random",
    "kind of",
    "sort of",
    "maybe we could",
    "i guess",
    "not sure if",
)

HEDGES = ("hopefully", "probably", "possibly", "if that is okay", "if that's okay")

SELF_INTRODUCTION = re.compile(
    r"\bi am\b|\bi'm\b|\bmy name is\b|\bi study\b|\bi work\b|\bi build\b|\bi do\b"
)

OFFER = re.compile(
    r"\bi can\b|\bi could help\b|\bi have experience\b|\bi know\b|\bi would be happy to\b"
)

IDEA_HEDGE = re.compile(r"\bi think maybe\b|\bi might be wrong\b|\bthis might be a bad idea\b")

GROUP_LANGUAGE = re.compile(r"\bwe\b|\bour\b|\bthe group\b")

INTEREST_MENTION = re.compile(
    r"photograph|react|data|hackathon|workshop|project|club|study|run|climb|music|design",
    re.IGNORECASE,
)


@dataclass
class CoachFeedback:
    strengths: list[str]
    improvements: list[str]
    suggested_revision: str
    next_step: str
    generated_by_model: bool
    provider: str


def _words(text: str) -> list[str]:
    return [word for word in re.sub(r"[^a-z0-9'\s]", " ", text.lower()).split() if word]


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def _build_revision(text: str, scenario_id: str, improvements: list[str]) -> str:
    sentences = _sentences(text)
    first = sentences[0] if sentences else text.strip()
    cleaned = first
    for phrase in (*FILLER_PHRASES, *HEDGES):
        cleaned = re.sub(phrase, "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip().lstrip(",; ")
    parts = [cleaned]
    if "?" not in text:
        parts.append(FOLLOW_UP_QUESTIONS.get(scenario_id, "What do you think?"))
    if any("who you are" in item for item in improvements):
        parts.insert(0, "I am working on a small project at the moment.")
    return re.sub(r"\s{2,}", " ", " ".join(parts)).strip()


def _build_next_step(scenario: dict[str, str], improvements: list[str]) -> str:
    if not improvements:
        return (
            "Send it as it is. Then read the match reasons again so your follow-up "
            "references something specific."
        )
    if any("no question" in item for item in improvements):
        return "Add one question, then send the message and keep the reply short."
    return (
        f"Revise the message once, then send it. Practising {scenario['focus'].lower()} "
        "improves fastest with real replies."
    )


def rule_coach(scenario_id: str, message: str) -> CoachFeedback:
    """Deterministic feedback. No model call, no invented content."""
    scenario = SCENARIO_BY_ID.get(scenario_id) or {
        "id": scenario_id,
        "focus": "this situation",
    }
    text = message.strip()
    lowered = text.lower()
    words = _words(text)

    strengths: list[str] = []
    improvements: list[str] = []

    specific = sum(1 for word in words if len(word) > 5)
    if specific >= 3 and INTEREST_MENTION.search(lowered):
        strengths.append(
            "You mention something concrete about the shared interest, which gives the "
            "other person an obvious thing to respond to."
        )

    if "?" in text:
        strengths.append(
            "You end with a question, which makes replying easy and keeps the conversation open."
        )
    else:
        improvements.append(
            "There is no question in this message. A short, specific question gives the "
            "other person a clear reason to reply."
        )

    filler = next((phrase for phrase in FILLER_PHRASES if phrase in lowered), None)
    if filler:
        improvements.append(
            f"“{filler}” weakens the opening. State your reason directly instead of "
            "apologising for it."
        )

    hedge = next((phrase for phrase in HEDGES if phrase in lowered), None)
    if hedge:
        improvements.append(
            f"“{hedge}” makes the message sound uncertain. If you want to do this, say so plainly."
        )

    if len(words) > 120:
        improvements.append(
            "This is long for a first message. Aim for two or three sentences so it is "
            "quick to read and answer."
        )
    elif 0 < len(words) < 8:
        improvements.append(
            "This is very short. Adding one detail about why you are writing gives the "
            "other person something to work with."
        )

    if scenario_id in {"introduce-yourself", "network-at-event"}:
        if SELF_INTRODUCTION.search(lowered):
            strengths.append(
                "You say who you are early, which is exactly what this scenario is practising."
            )
        else:
            improvements.append(
                "Add one line about who you are or what you are working on. It anchors the "
                "rest of the message."
            )

    if OFFER.search(lowered):
        strengths.append(
            "You offer something you can contribute, which turns the message into a "
            "two-way exchange rather than a request."
        )

    if scenario_id == "express-ideas" and IDEA_HEDGE.search(lowered):
        improvements.append(
            "You undercut your own idea. Propose it, then invite disagreement separately."
        )

    if (
        scenario_id == "join-group-discussion"
        and len(words) >= 25
        and GROUP_LANGUAGE.search(lowered)
    ):
        strengths.append(
            "You speak to the group rather than at it, which is what makes a contribution "
            "land in a discussion."
        )

    if not strengths:
        strengths = [
            "You wrote something rather than nothing, which is the hardest part of this scenario."
        ]

    return CoachFeedback(
        strengths=strengths[:3],
        improvements=improvements[:3],
        suggested_revision=_build_revision(text, scenario_id, improvements),
        next_step=_build_next_step(scenario, improvements),
        generated_by_model=False,
        provider="converge-rule-engine",
    )


SYSTEM_PROMPT = (
    "You are the Converge conversation coach. Converge helps people find common ground "
    "and start meaningful conversations. You give short, specific, kind feedback on a "
    "practice message. Never write the message for them wholesale, never moralise, and "
    "never invent facts about the other person.\n"
    "Reply with JSON only, using exactly these keys: strengths (array of 1-3 strings), "
    "improvements (array of 0-3 strings), suggested_revision (string), next_step (string). "
    "Each improvement must name the exact phrase or gap it refers to."
)


class CoachService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def model_enabled(self) -> bool:
        return self._settings.coach_model_enabled

    def unavailable_reason(self) -> str:
        return (
            "No coach model is configured. Set COACH_MODEL, COACH_API_KEY and COACH_API_URL "
            "on the Converge backend to enable model-backed feedback."
        )

    async def coach(
        self, scenario_id: str, message: str, match_context: list[str] | None = None
    ) -> CoachFeedback:
        """Model feedback, falling back to the rule engine when unavailable.

        The fallback is reported in the response rather than hidden, so the UI can
        label it.
        """
        if not self.model_enabled:
            return rule_coach(scenario_id, message)
        try:
            return await self._model_feedback(scenario_id, message, match_context or [])
        except (ProviderUnavailableError, httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError):
            return rule_coach(scenario_id, message)

    async def _model_feedback(
        self, scenario_id: str, message: str, match_context: list[str]
    ) -> CoachFeedback:
        scenario = SCENARIO_BY_ID.get(scenario_id)
        if not scenario:
            raise ProviderUnavailableError(
                f"“{scenario_id}” is not a Converge practice scenario."
            )
        if len(message) > MAX_MESSAGE_LENGTH:
            raise ProviderUnavailableError(
                f"Practice messages are limited to {MAX_MESSAGE_LENGTH} characters."
            )

        context_lines = "\n".join(f"- {item}" for item in match_context) or "- none provided"
        user_prompt = (
            f"Scenario: {scenario['title']} — {scenario['description']}\n"
            f"Focus: {scenario['focus']}\n"
            f"Shared signals with the other member:\n{context_lines}\n\n"
            f"The message they wrote:\n---\n{message}\n---"
        )
        payload = {
            "model": self._settings.coach_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self._settings.coach_api_url,
                headers={
                    "Authorization": f"Bearer {self._settings.coach_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code >= 400:
            raise ProviderUnavailableError(
                f"The coach model rejected the request ({response.status_code})."
            )
        body = response.json()
        content = (body["choices"][0]["message"]["content"] or "").strip()
        parsed = json.loads(content)

        strengths = [str(item) for item in parsed.get("strengths") or []][:3]
        improvements = [str(item) for item in parsed.get("improvements") or []][:3]
        revision = str(parsed.get("suggested_revision") or "").strip()
        next_step = str(parsed.get("next_step") or "").strip()
        if not strengths or not revision or not next_step:
            # An incomplete model reply is a provider failure, not something to
            # paper over with a half-filled response.
            raise ProviderUnavailableError("The coach model returned an incomplete response.")

        return CoachFeedback(
            strengths=strengths,
            improvements=improvements,
            suggested_revision=revision,
            next_step=next_step,
            generated_by_model=True,
            provider=self._settings.coach_model,
        )
