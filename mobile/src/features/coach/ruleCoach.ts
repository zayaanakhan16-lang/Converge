import type { CoachFeedback, CoachScenario } from '../../services/backend';

/**
 * Deterministic conversation coach.
 *
 * This is a real analyser, not a placeholder and not a language model. It applies
 * explicit, explainable rules to the practice message and reports exactly which
 * rule fired. When the Python backend is configured, the model-backed coach is
 * used instead and this analyser becomes the offline fallback, clearly labelled
 * as rule-based so a user always knows what produced the feedback.
 */

interface Rule {
  id: string;
  /** Returns the observation, or null when the rule does not apply. */
  evaluate(input: RuleInput): Observation | null;
}

interface RuleInput {
  text: string;
  lower: string;
  words: string[];
  sentences: string[];
  scenario: CoachScenario;
}

interface Observation {
  /** Whether this is a strength or an improvement. */
  kind: 'strength' | 'improvement';
  message: string;
}

const FILLER_PHRASES = [
  'just wanted to',
  'sorry to bother',
  'i know this is random',
  'kind of',
  'sort of',
  'maybe we could',
  'i guess',
  'not sure if',
];

const HEDGES = ['hopefully', 'probably', 'possibly', 'if that is okay', 'if that’s okay'];

const QUESTIONS = /\?/;

const RULES: Rule[] = [
  {
    id: 'specific-detail',
    evaluate: ({ words, lower }) => {
      const specific = words.filter((word) => word.length > 5).length;
      const mentionsInterest = /photograph|react|data|hackathon|workshop|project|club|study|run|climb|music|design/i.test(
        lower,
      );
      if (specific >= 3 && mentionsInterest) {
        return {
          kind: 'strength',
          message:
            'You mention something concrete about the shared interest, which gives the other person an obvious thing to respond to.',
        };
      }
      return null;
    },
  },
  {
    id: 'asks-a-question',
    evaluate: ({ text }) =>
      QUESTIONS.test(text)
        ? {
            kind: 'strength',
            message:
              'You end with a question, which makes replying easy and keeps the conversation open.',
          }
        : null,
  },
  {
    id: 'no-question',
    evaluate: ({ text }) =>
      QUESTIONS.test(text)
        ? null
        : {
            kind: 'improvement',
            message:
              'There is no question in this message. A short, specific question gives the other person a clear reason to reply.',
          },
  },
  {
    id: 'filler',
    evaluate: ({ lower }) => {
      const found = FILLER_PHRASES.find((phrase) => lower.includes(phrase));
      return found
        ? {
            kind: 'improvement',
            message: `“${found}” weakens the opening. State your reason directly instead of apologising for it.`,
          }
        : null;
    },
  },
  {
    id: 'hedging',
    evaluate: ({ lower }) => {
      const found = HEDGES.find((phrase) => lower.includes(phrase));
      return found
        ? {
            kind: 'improvement',
            message: `“${found}” makes the message sound uncertain. If you want to do this, say so plainly.`,
          }
        : null;
    },
  },
  {
    id: 'too-long',
    evaluate: ({ words }) =>
      words.length > 120
        ? {
            kind: 'improvement',
            message:
              'This is long for a first message. Aim for two or three sentences so it is quick to read and answer.',
          }
        : null,
  },
  {
    id: 'too-short',
    evaluate: ({ words }) =>
      words.length > 0 && words.length < 8
        ? {
            kind: 'improvement',
            message:
              'This is very short. Adding one detail about why you are writing gives the other person something to work with.',
          }
        : null,
  },
  {
    id: 'self-intro',
    evaluate: ({ lower, scenario }) => {
      if (scenario.id !== 'introduce-yourself' && scenario.id !== 'network-at-event') return null;
      const introduces =
        /\bi am\b|\bi'm\b|\bmy name is\b|\bi study\b|\bi work\b|\bi build\b|\bi do\b/.test(lower);
      return introduces
        ? {
            kind: 'strength',
            message:
              'You say who you are early, which is exactly what this scenario is practising.',
          }
        : {
            kind: 'improvement',
            message:
              'Add one line about who you are or what you are working on. It anchors the rest of the message.',
          };
    },
  },
  {
    id: 'offers-something',
    evaluate: ({ lower }) =>
      /\bi can\b|\bi could help\b|\bi have experience\b|\bi know\b|\bi would be happy to\b/.test(lower)
        ? {
            kind: 'strength',
            message:
              'You offer something you can contribute, which turns the message into a two-way exchange rather than a request.',
          }
        : null,
  },
  {
    id: 'idea-hedge',
    evaluate: ({ lower, scenario }) => {
      if (scenario.id !== 'express-ideas') return null;
      return /\bi think maybe\b|\bi might be wrong\b|\bthis might be a bad idea\b/.test(lower)
        ? {
            kind: 'improvement',
            message:
              'You undercut your own idea. Propose it, then invite disagreement separately.',
          }
        : null;
    },
  },
  {
    id: 'group-contribution',
    evaluate: ({ words, lower, scenario }) => {
      if (scenario.id !== 'join-group-discussion') return null;
      return words.length >= 25 && /\bwe\b|\bour\b|\bthe group\b/.test(lower)
        ? {
            kind: 'strength',
            message:
              'You speak to the group rather than at it, which is what makes a contribution land in a discussion.',
          }
        : null;
    },
  },
];

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Builds one concrete revision.
 *
 * The rewrite is assembled from the user's own sentences so the suggestion stays
 * in their voice instead of replacing it with generic advice.
 */
function buildRevision(input: RuleInput, improvements: string[]): string {
  const { text, sentences, scenario } = input;
  const firstSentence = sentences[0] ?? text.trim();
  const cleaned = FILLER_PHRASES.concat(HEDGES).reduce(
    (value, phrase) => value.replace(new RegExp(phrase, 'gi'), '').replace(/\s{2,}/g, ' '),
    firstSentence,
  );
  const trimmed = cleaned.trim().replace(/^[,;]\s*/, '');
  const needsQuestion = !QUESTIONS.test(text);
  const questionFor: Record<string, string> = {
    'introduce-yourself': 'Would you be up for comparing notes on it some time?',
    'start-conversation': 'What got you into it originally?',
    'network-at-event': 'What are you hoping to get out of today?',
    'ask-a-question': 'Would you be open to pointing me at one thing to try first?',
    'join-group-discussion': 'How did you handle the sign-up side of it?',
    'express-ideas': 'Would that be something you would want to work on together?',
  };
  const parts = [trimmed];
  if (needsQuestion) parts.push(questionFor[scenario.id] ?? 'What do you think?');
  if (improvements.some((item) => item.includes('who you are'))) {
    parts.unshift('I am working on a small project at the moment.');
  }
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function buildNextStep(scenario: CoachScenario, improvements: string[]): string {
  if (improvements.length === 0) {
    return 'Send it as it is. Then read the match reasons again so your follow-up references something specific.';
  }
  if (improvements.some((item) => item.includes('no question'))) {
    return 'Add one question, then send the message and keep the reply short.';
  }
  return `Revise the message once, then send it. Practising ${scenario.focus.toLowerCase()} improves fastest with real replies.`;
}

export function coachWithRules(input: {
  scenarioId: string;
  message: string;
  scenario: CoachScenario;
}): CoachFeedback {
  const text = input.message.trim();
  const ruleInput: RuleInput = {
    text,
    lower: text.toLowerCase(),
    words: tokenise(text),
    sentences: splitSentences(text),
    scenario: input.scenario,
  };

  const observations = RULES.map((rule) => rule.evaluate(ruleInput)).filter(
    (value): value is Observation => value !== null,
  );

  const strengths = observations.filter((o) => o.kind === 'strength').map((o) => o.message);
  const improvements = observations.filter((o) => o.kind === 'improvement').map((o) => o.message);

  return {
    strengths:
      strengths.length > 0
        ? strengths.slice(0, 3)
        : [
            'You wrote something rather than nothing, which is the hardest part of this scenario.',
          ],
    improvements: improvements.slice(0, 3),
    suggestedRevision: buildRevision(ruleInput, improvements),
    nextStep: buildNextStep(input.scenario, improvements),
    generatedByModel: false,
    provider: 'converge-rule-engine',
  };
}
