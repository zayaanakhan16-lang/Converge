import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/ui/Text';
import { WaveformBars } from './WaveformBars';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import type { Message } from '../../types/domain';
import { formatClockTime } from '../../utils/format';

export interface MessageBubbleProps {
  message: Message;
  /** True when the signed-in member sent it. */
  mine: boolean;
  /** Language the reader prefers; used to decide whether to show a translation. */
  readerLanguage: string;
  senderName: string;
  onReport?: () => void;
}

/**
 * A single message.
 *
 * When a translation exists and differs from the original, the translated text
 * leads and the original stays one tap away. Nothing is ever silently replaced.
 */
export function MessageBubble({
  message,
  mine,
  readerLanguage,
  senderName,
  onReport,
}: MessageBubbleProps) {
  const { theme } = useTheme();
  const translation = message.translation;
  const showTranslation = Boolean(
    translation && translation.wasTranslated && translation.targetLanguage !== readerLanguage,
  );
  const [showOriginal, setShowOriginal] = useState(false);

  const background = mine ? theme.colors.primary : theme.colors.surface;
  const textColour = mine ? theme.colors.onPrimary : theme.colors.textPrimary;
  const metaColour = mine ? theme.colors.onPrimary : theme.colors.textMuted;

  const primaryText = showTranslation && !showOriginal ? translation!.text : message.body;

  return (
    <View
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
      accessibilityLabel={`${mine ? 'You' : senderName} at ${formatClockTime(message.createdAt)}: ${primaryText}`}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: background,
            borderColor: mine ? 'transparent' : theme.colors.border,
            borderTopLeftRadius: mine ? radius.lg : radius.sm,
            borderTopRightRadius: mine ? radius.sm : radius.lg,
          },
        ]}
      >
        {showTranslation ? (
          <View style={styles.translationHeader}>
            <Text token="label" color={metaColour}>
              {showOriginal ? 'ORIGINAL' : `TRANSLATED · ${translation!.targetLanguage.toUpperCase()}`}
            </Text>
          </View>
        ) : null}

        <Text token="body" color={textColour}>
          {primaryText}
        </Text>

        {message.voiceNoteSeconds ? (
          <View style={styles.voice}>
            {message.waveform?.length ? (
              <WaveformBars
                bars={message.waveform}
                height={22}
                color={metaColour}
                style={styles.waveform}
              />
            ) : null}
            <Text token="caption" color={metaColour}>
              Voice note · {formatDuration(message.voiceNoteSeconds)}
            </Text>
          </View>
        ) : null}

        {message.attachments.length > 0 ? (
          <Text token="caption" color={metaColour} style={styles.voice}>
            {message.attachments.length}{' '}
            {message.attachments.length === 1 ? 'attachment' : 'attachments'}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <Text token="caption" color={metaColour}>
            {formatClockTime(message.createdAt)}
          </Text>
          {mine ? <DeliveryState state={message.state} colour={metaColour} /> : null}
        </View>

        {showTranslation ? (
          <Pressable
            onPress={() => setShowOriginal((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={showOriginal ? 'Show translation' : 'Show original message'}
            hitSlop={6}
          >
            <Text token="caption" color={metaColour} style={styles.toggle}>
              {showOriginal ? 'Show translation' : 'Show original'}
            </Text>
          </Pressable>
        ) : null}

        {translation && !translation.wasTranslated ? (
          <Text token="caption" color={metaColour} style={styles.toggle}>
            Already in {translation.targetLanguage.toUpperCase()}
          </Text>
        ) : null}
      </View>

      {!mine && onReport ? (
        <Pressable
          onPress={onReport}
          accessibilityRole="button"
          accessibilityLabel={`Report message from ${senderName}`}
          hitSlop={8}
          style={styles.report}
        >
          <AlertCircle size={14} color={theme.colors.textMuted} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

function DeliveryState({ state, colour }: { state: Message['state']; colour: string }) {
  if (state === 'sending') return <Clock size={12} color={colour} strokeWidth={2.2} />;
  if (state === 'failed') return <AlertCircle size={12} color="#E5484D" strokeWidth={2.2} />;
  if (state === 'read') return <CheckCheck size={12} color={colour} strokeWidth={2.4} />;
  if (state === 'delivered') return <CheckCheck size={12} color={colour} strokeWidth={2} />;
  return <Check size={12} color={colour} strokeWidth={2.4} />;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md },
  rowMine: { justifyContent: 'flex-end', paddingLeft: spacing.huge },
  rowTheirs: { justifyContent: 'flex-start', paddingRight: spacing.huge },
  bubble: {
    maxWidth: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: spacing.xs,
  },
  translationHeader: { marginBottom: spacing.xxs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  toggle: { marginTop: spacing.xxs },
  voice: { marginTop: spacing.xxs, gap: spacing.xxs },
  waveform: { marginTop: spacing.xxs, maxWidth: 220 },
  report: { padding: spacing.xs, paddingBottom: spacing.lg },
});
