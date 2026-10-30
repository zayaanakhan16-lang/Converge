import { backendConfig } from '../../constants/config';
import { backend, BackendUnavailableError } from '../../services/backend';
import type { Message, MessageTranslation } from '../../types/domain';

/**
 * Translation pipeline.
 *
 * Steps, in order:
 *   1. The sender writes (or records) a message.
 *   2. If a voice note was recorded and the backend supports transcription, the
 *      audio is transcribed to text.
 *   3. The text is translated by the configured provider.
 *   4. The recipient reads the translation, with the original one tap away.
 *   5. The translation is stored so it is only produced once per target language.
 *
 * There is no offline fallback that invents a translation. When no provider is
 * configured the pipeline reports `unavailable` and the UI says so.
 */

export type TranslationOutcome =
  | { status: 'translated'; translation: MessageTranslation }
  | { status: 'not-needed'; translation: MessageTranslation }
  | { status: 'unavailable'; reason: string }
  | { status: 'failed'; reason: string };

/** A provider is any function that can translate text between two languages. */
export interface TranslationProvider {
  readonly name: string;
  translate(input: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<{ text: string; wasTranslated: boolean }>;
}

/**
 * The Converge backend provider.
 *
 * The FastAPI service owns the provider API keys, so no translation credential
 * ever ships inside the mobile bundle.
 */
const convergeBackendProvider: TranslationProvider = {
  name: 'converge-backend',
  async translate(input) {
    const result = await backend.translate(input);
    return { text: result.text, wasTranslated: result.wasTranslated };
  },
};

export function activeTranslationProvider(): TranslationProvider | null {
  return backendConfig.isConfigured ? convergeBackendProvider : null;
}

export function translationAvailability(): { available: boolean; reason: string | null } {
  if (!backendConfig.isConfigured) {
    return {
      available: false,
      reason:
        'No translation provider is configured. Set EXPO_PUBLIC_BACKEND_URL and run the Converge backend.',
    };
  }
  return { available: true, reason: null };
}

export async function translateMessage(input: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<TranslationOutcome> {
  const provider = activeTranslationProvider();
  if (!provider) {
    return {
      status: 'unavailable',
      reason: translationAvailability().reason ?? 'Translation is unavailable.',
    };
  }
  if (input.sourceLanguage === input.targetLanguage) {
    return {
      status: 'not-needed',
      translation: {
        targetLanguage: input.targetLanguage,
        text: input.text,
        provider: 'none',
        wasTranslated: false,
        createdAt: new Date().toISOString(),
      },
    };
  }
  try {
    const result = await provider.translate(input);
    return {
      status: result.wasTranslated ? 'translated' : 'not-needed',
      translation: {
        targetLanguage: input.targetLanguage,
        text: result.text,
        provider: provider.name,
        wasTranslated: result.wasTranslated,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (caught) {
    return {
      status: 'failed',
      reason:
        caught instanceof BackendUnavailableError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Translation failed.',
    };
  }
}

/**
 * Ensures a message has a translation for the reader's language.
 *
 * Returns the message unchanged when a translation already exists, so the UI can
 * call this freely as messages scroll into view.
 */
export async function ensureTranslation(
  message: Message,
  readerLanguage: string,
  senderLanguage: string,
): Promise<Message> {
  if (message.translation?.targetLanguage === readerLanguage) return message;
  if (readerLanguage === senderLanguage) return message;
  const outcome = await translateMessage({
    text: message.body,
    sourceLanguage: senderLanguage,
    targetLanguage: readerLanguage,
  });
  if (outcome.status === 'translated' || outcome.status === 'not-needed') {
    return { ...message, translation: outcome.translation };
  }
  return message;
}

/** Transcription of a recorded voice note, when the backend supports it. */
export async function transcribeVoiceNote(input: {
  uri: string;
  mimeType: string;
  languageHint?: string;
}): Promise<
  | { status: 'transcribed'; text: string; provider: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'failed'; reason: string }
> {
  if (!backendConfig.isConfigured) {
    return {
      status: 'unavailable',
      reason:
        'Voice-note transcription needs the Converge backend. The audio is still sent as a voice note.',
    };
  }
  try {
    const response = await fetch(input.uri);
    const buffer = await response.arrayBuffer();
    // Base64 encoding without a dependency: chunked to avoid call-stack limits.
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    const result = await backend.transcribe({
      audioBase64: globalThis.btoa(binary),
      mimeType: input.mimeType,
      languageHint: input.languageHint,
    });
    return { status: 'transcribed', text: result.text, provider: result.provider };
  } catch (caught) {
    return {
      status: 'failed',
      reason: caught instanceof Error ? caught.message : 'Transcription failed.',
    };
  }
}
