import type { CoachFeedback, CoachScenario } from '../../services/backend';

/**
 * Conversation coach scenarios.
 *
 * These are the six situations the brief names. Each one has a specific focus
 * and an opening prompt so practice is anchored to a real situation rather than
 * open-ended chat.
 */
export const COACH_SCENARIOS: CoachScenario[] = [
  {
    id: 'introduce-yourself',
    title: 'Introduce yourself',
    description: 'Write an opening that gives the other person something to reply to.',
    focus: 'Introducing yourself',
    openingPrompt:
      'Write the first message you would send to someone you were matched with because you both like photography.',
  },
  {
    id: 'start-conversation',
    title: 'Start a conversation',
    description: 'Open a conversation with someone you have never spoken to before.',
    focus: 'Starting conversations',
    openingPrompt:
      'Write a message that opens a conversation with a member of a community you just joined.',
  },
  {
    id: 'network-at-event',
    title: 'Network at an event',
    description: 'Introduce yourself at a workshop or meet-up without sounding rehearsed.',
    focus: 'Networking at events',
    openingPrompt:
      'You are at a public workshop on data science. Write what you would say to someone standing next to you.',
  },
  {
    id: 'ask-a-question',
    title: 'Ask a useful question',
    description: 'Ask for help in a way that makes it easy for someone to say yes.',
    focus: 'Asking questions',
    openingPrompt:
      'You want help learning React from someone whose profile says they build front-end projects. Write the question.',
  },
  {
    id: 'join-group-discussion',
    title: 'Join a group discussion',
    description: 'Add something useful to a discussion that is already underway.',
    focus: 'Joining group discussions',
    openingPrompt:
      'A community discussion is about how to run a first hackathon. Write your contribution.',
  },
  {
    id: 'express-ideas',
    title: 'Express an idea confidently',
    description: 'State an opinion or proposal without over-qualifying it.',
    focus: 'Expressing ideas confidently',
    openingPrompt:
      'Propose a project idea to a potential collaborator. Write it as you would send it.',
  },
];

export function scenarioById(id: string): CoachScenario | null {
  return COACH_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

export interface CoachSessionMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  createdAt: string;
  /** Present on coach turns that carried structured feedback. */
  feedback?: CoachFeedback;
}

/** Copy shown when the model-backed coach cannot be reached. */
export const RULE_BASED_COACH_LABEL = 'Rule-based feedback';
export const MODEL_COACH_LABEL = 'Model feedback';
