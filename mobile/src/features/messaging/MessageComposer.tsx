import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Languages, Mic, Paperclip, SendHorizontal, Smile, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { InlineMessage } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { LANGUAGES } from '../../constants/taxonomy';
import { useTheme } from '../../context/ThemeContext';
import { backend, BackendUnavailableError } from '../../services/backend';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme';
import { validateOutgoingMessage, MAX_MESSAGE_LENGTH } from '../../utils/validation';

/** Emoji set offered inline: enough for everyday messages, no dependency. */
const QUICK_EMOJI = ['😀', '🙂', '👋', '👍', '🎉', '🙏', '❤️', '😂', '🤔', '✅', '🔥', '📚'];

export interface MessageComposerProps {
  /** Sender's preferred language, used as the translation source. */
  sourceLanguage: string;
  /** Recipient's preferred language, used as the translation target. */
  targetLanguage: string;
  /** True when the backend is reachable, so translation can be offered. */
  translationAvailable: boolean;
  sending: boolean;
  onSend: (input: { body: string; translateTo: string | null }) => Promise<void>;
  /** Called when the user records a voice note. */
  onRecordVoiceNote?: () => void;
  /** Explains why recording is unavailable when it is. */
  voiceNoteDisabledReason?: string;
  /** Attachments are validated by the caller before upload. */
  onAttach?: () => void;
  attachmentDisabledReason?: string;
}

/**
 * Message composer.
 *
 * Translation is an explicit choice per message, shown as a toggle above the
 * field, because silently rewriting what someone sends would misrepresent them.
 */
export function MessageComposer({
  sourceLanguage,
  targetLanguage,
  translationAvailable,
  sending,
  onSend,
  onRecordVoiceNote,
  voiceNoteDisabledReason,
  onAttach,
  attachmentDisabledReason,
}: MessageComposerProps) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');
  const [translate, setTranslate] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const languagesDiffer = sourceLanguage !== targetLanguage;
  const canTranslate = translationAvailable && languagesDiffer;

  const targetLabel = useMemo(
    () => LANGUAGES.find((language) => language.code === targetLanguage)?.label ?? targetLanguage,
    [targetLanguage],
  );

  const send = async () => {
    const validation = validateOutgoingMessage(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setPreview(null);
    const body = draft.trim();
    setDraft('');
    try {
      await onSend({ body, translateTo: canTranslate && translate ? targetLanguage : null });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch (caught) {
      // Restore the draft so nothing the user typed is lost on failure.
      setDraft(body);
      setError(caught instanceof Error ? caught.message : 'Could not send that message.');
    }
  };

  const runPreview = async () => {
    const validation = validateOutgoingMessage(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const result = await backend.translate({
        text: draft.trim(),
        sourceLanguage,
        targetLanguage,
      });
      setPreview(
        result.wasTranslated
          ? result.text
          : `No change: ${result.provider} reports the message is already in ${targetLabel}.`,
      );
    } catch (caught) {
      setPreview(
        caught instanceof BackendUnavailableError
          ? caught.message
          : 'Translation preview failed. The message has not been sent.',
      );
    } finally {
      setPreviewing(false);
    }
  };

  const remaining = MAX_MESSAGE_LENGTH - draft.length;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
      ]}
    >
      {canTranslate ? (
        <View style={styles.translateRow}>
          <Pressable
            onPress={() => setTranslate((value) => !value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: translate }}
            accessibilityLabel={`Translate my message into ${targetLabel} before sending`}
            style={styles.translateToggle}
          >
            <Languages
              size={15}
              color={translate ? theme.colors.accent : theme.colors.textMuted}
              strokeWidth={2}
            />
            <Text token="caption" tone={translate ? 'accent' : 'muted'}>
              {translate ? `Sending translated to ${targetLabel}` : `Send translated to ${targetLabel}`}
            </Text>
          </Pressable>
          {translate ? (
            <Pressable
              onPress={runPreview}
              accessibilityRole="button"
              accessibilityLabel="Preview the translation"
              hitSlop={8}
            >
              <Text token="caption" tone="accent">
                {previewing ? 'Translating…' : 'Preview'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : !translationAvailable ? (
        <Text token="caption" tone="muted" style={styles.translateNote}>
          Translation is unavailable until the Converge backend is configured.
        </Text>
      ) : (
        <Text token="caption" tone="muted" style={styles.translateNote}>
          You and this member share {targetLabel}, so no translation is needed.
        </Text>
      )}

      {preview ? (
        <InlineMessage tone="info" message={`Preview — recipient sees: “${preview}”`} />
      ) : null}
      {error ? <InlineMessage tone="error" message={error} /> : null}

      {showEmoji ? (
        <View style={styles.emojiRow}>
          {QUICK_EMOJI.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => setDraft((value) => value + emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Insert ${emoji}`}
              style={styles.emojiButton}
            >
              <Text token="title3">{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={() => setShowEmoji((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={showEmoji ? 'Hide emoji' : 'Show emoji'}
          style={styles.iconButton}
        >
          {showEmoji ? (
            <X size={20} color={theme.colors.textSecondary} strokeWidth={2} />
          ) : (
            <Smile size={20} color={theme.colors.textSecondary} strokeWidth={2} />
          )}
        </Pressable>

        <TextInput
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (error) setError(null);
          }}
          placeholder="Write a message"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Message text"
          style={[
            typography.body,
            styles.input,
            {
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        />

        {onAttach ? (
          <Pressable
            onPress={onAttach}
            accessibilityRole="button"
            accessibilityLabel={
              attachmentDisabledReason ? `Attach a file. ${attachmentDisabledReason}` : 'Attach a file'
            }
            accessibilityState={{ disabled: Boolean(attachmentDisabledReason) }}
            style={styles.iconButton}
          >
            <Paperclip
              size={19}
              color={attachmentDisabledReason ? theme.colors.textMuted : theme.colors.textSecondary}
              strokeWidth={2}
            />
          </Pressable>
        ) : null}

        {onRecordVoiceNote ? (
          <Pressable
            onPress={onRecordVoiceNote}
            accessibilityRole="button"
            accessibilityLabel={
              voiceNoteDisabledReason ? `Record a voice note. ${voiceNoteDisabledReason}` : 'Record a voice note'
            }
            accessibilityState={{ disabled: Boolean(voiceNoteDisabledReason) }}
            style={styles.iconButton}
          >
            <Mic
              size={19}
              color={voiceNoteDisabledReason ? theme.colors.textMuted : theme.colors.textSecondary}
              strokeWidth={2}
            />
          </Pressable>
        ) : null}

        <Pressable
          onPress={send}
          disabled={sending || draft.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: sending || draft.trim().length === 0 }}
          style={[
            styles.sendButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: sending || draft.trim().length === 0 ? 0.45 : 1,
            },
          ]}
        >
          <SendHorizontal size={18} color={theme.colors.onPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.footerRow}>
        {remaining < 200 ? (
          <Text token="caption" tone={remaining < 40 ? 'danger' : 'muted'}>
            {remaining} characters left
          </Text>
        ) : (
          <Text token="caption" tone="muted">
            {Platform.OS === 'android' ? 'Long press to paste from clipboard' : 'Drafts are kept until you send or leave'}
          </Text>
        )}
        {Platform.OS === 'android' ? (
          <Pressable
            onPress={async () => {
              const text = await Clipboard.getStringAsync();
              if (text) setDraft((value) => (value ? `${value}${text}` : text));
            }}
            accessibilityRole="button"
            accessibilityLabel="Paste from clipboard"
            hitSlop={8}
          >
            <Text token="caption" tone="accent">
              Paste
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  translateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  translateToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  translateNote: { marginBottom: spacing.xxs },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiButton: { padding: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  iconButton: {
    width: 40,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    maxHeight: 132,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  sendButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
