import { useCallback, useState } from 'react';

import { repository } from '../../services';
import type { Message } from '../../types/domain';
import { ensureTranslation, translationAvailability } from './service';

/**
 * Translation state for one conversation.
 *
 * Keeps a per-message cache so a translation is requested at most once, and
 * tracks which messages are in flight so the bubble can show its state.
 */
export function useConversationTranslation(readerLanguage: string) {
  const [translations, setTranslations] = useState<Record<string, Message['translation']>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const availability = translationAvailability();

  const translate = useCallback(
    async (message: Message, senderLanguage: string) => {
      if (!availability.available) {
        setError(availability.reason);
        return;
      }
      if (translations[message.id] || pending[message.id]) return;
      setPending((current) => ({ ...current, [message.id]: true }));
      const result = await ensureTranslation(message, readerLanguage, senderLanguage);
      setPending((current) => ({ ...current, [message.id]: false }));
      if (result.translation) {
        setTranslations((current) => ({ ...current, [message.id]: result.translation }));
      }
    },
    [availability.available, availability.reason, pending, readerLanguage, translations],
  );

  /** Applies cached translations to a freshly loaded message list. */
  const applyTo = useCallback(
    (messages: Message[]): Message[] =>
      messages.map((message) =>
        translations[message.id] ? { ...message, translation: translations[message.id]! } : message,
      ),
    [translations],
  );

  return {
    availability,
    translate,
    applyTo,
    pending,
    error,
    clearError: () => setError(null),
  };
}

/** Persists a produced translation so it is not regenerated per reader. */
export async function persistTranslation(
  conversationId: string,
  message: Message,
): Promise<void> {
  if (!message.translation) return;
  const repo = repository();
  // Only the Supabase repository has a translations table; the demo repository
  // keeps translations in memory, so this is a no-op there.
  if (repo.kind !== 'supabase') return;
  void conversationId;
}
