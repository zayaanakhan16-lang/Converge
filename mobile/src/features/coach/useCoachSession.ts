import { useCallback, useState } from 'react';

import { backend, BackendUnavailableError, type CoachFeedback } from '../../services/backend';
import { scenarioById, type CoachSessionMessage } from './scenarios';
import { coachWithRules } from './ruleCoach';

/**
 * Conversation coach state.
 *
 * Tries the model-backed coach first and falls back to the rule-based analyser,
 * always reporting which one produced the feedback. A failed model call is
 * surfaced as an explicit notice rather than silently substituted.
 */
export interface CoachState {
  messages: CoachSessionMessage[];
  busy: boolean;
  /** Explains when the model was unreachable and the rules were used instead. */
  fallbackNotice: string | null;
  error: string | null;
  submit: (scenarioId: string, message: string) => Promise<void>;
  reset: () => void;
}

export function useCoachSession(): CoachState {
  const [messages, setMessages] = useState<CoachSessionMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (scenarioId: string, message: string) => {
    const scenario = scenarioById(scenarioId);
    if (!scenario) {
      setError('That practice scenario is no longer available.');
      return;
    }
    setBusy(true);
    setError(null);
    setFallbackNotice(null);

    const userTurn: CoachSessionMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userTurn]);

    let feedback: CoachFeedback | null = null;
    try {
      feedback = await backend.coachFeedback({ scenarioId, message: message.trim() });
    } catch (caught) {
      const reason =
        caught instanceof BackendUnavailableError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'The coach service did not respond.';
      setFallbackNotice(
        `The model-backed coach is unavailable, so this feedback comes from Converge's rule-based analyser. Reason: ${reason}`,
      );
      feedback = coachWithRules({ scenarioId, message, scenario });
    }

    setMessages((current) => [
      ...current,
      {
        id: `coach-${Date.now()}`,
        role: 'coach',
        content: feedback!.strengths[0] ?? 'Feedback generated.',
        createdAt: new Date().toISOString(),
        feedback: feedback!,
      },
    ]);
    setBusy(false);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setFallbackNotice(null);
    setError(null);
  }, []);

  return { messages, busy, fallbackNotice, error, submit, reset };
}
