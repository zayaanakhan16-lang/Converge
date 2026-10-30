import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Flag, Languages, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Chip, LoadingState } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { labelForLanguage } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MessageBubble } from '../../features/messaging/MessageBubble';
import { MessageComposer } from '../../features/messaging/MessageComposer';
import { transcribeVoiceNote } from '../../features/translation/service';
import { useConversationTranslation } from '../../features/translation/useConversationTranslation';
import { useConversation, useMessages, useProfile, useMutation } from '../../hooks/useData';
import { useVoiceNoteRecorder } from '../../hooks/useVoiceNoteRecorder';
import { voiceNoteWaveform } from '../../services/native/audio';
import type { MessagesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../theme';
import { REPORT_REASONS, type Message, type ReportReason } from '../../types/domain';
import { ATTACHMENT_RULES } from '../../utils/validation';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Chat'>;

/**
 * Direct conversation.
 *
 * Messaging only exists between connected members: the repository refuses to
 * open a conversation otherwise, and this screen explains that state instead of
 * showing a broken composer.
 */
export function ChatScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { conversationId } = route.params;
  const { user, profile: viewer, isDemoMode } = useAuth();
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const recorder = useVoiceNoteRecorder();

  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportDetail, setReportDetail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);
  const [overrideLanguage, setOverrideLanguage] = useState<string | null>(null);

  const otherId = conversation.data?.participantIds.find((id) => id !== user?.id);
  const other = useProfile(otherId);
  const viewerLanguage = viewer?.languages[0] ?? 'en';
  const readerLanguage = overrideLanguage ?? viewerLanguage;
  const translation = useConversationTranslation(readerLanguage);

  const send = useMutation(
    useCallback(
      async (input: {
        body: string;
        translateTo: string | null;
        voiceNoteSeconds?: number;
        waveform?: number[];
      }) => {
        if (!user) throw new Error('You need to be signed in.');
        const message = await repository().sendMessage(user.id, {
          conversationId,
          body: input.body,
          voiceNoteSeconds: input.voiceNoteSeconds,
          waveform: input.waveform,
        });
        // Translation is produced after the message is stored, so a provider
        // outage never loses what the member wrote.
        const targetLanguage = input.translateTo;
        if (targetLanguage) {
          const { translateMessage } = await import('../../features/translation/service');
          const outcome = await translateMessage({
            text: input.body,
            sourceLanguage: viewerLanguage,
            targetLanguage,
          });
          if (outcome.status === 'unavailable' || outcome.status === 'failed') {
            setNotice(`Message sent, but the translation could not be produced: ${outcome.reason}`);
          }
        }
        return message;
      },
      [conversationId, user, viewerLanguage],
    ),
  );

  const report = useMutation(
    useCallback(
      async (input: { subjectUserId?: string; subjectMessageId?: string; reason: ReportReason; detail?: string }) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().submitReport(user.id, input);
      },
      [user],
    ),
  );

  useEffect(() => {
    if (!user || !conversationId) return;
    void repository().markConversationRead(conversationId, user.id).catch(() => undefined);
  }, [conversationId, messages.data.length, user]);

  const senderLanguage = other.data?.languages[0] ?? readerLanguage;

  const decorated = useMemo(() => translation.applyTo(messages.data), [messages.data, translation]);

  const submitReport = async () => {
    const result = await report.run({
      subjectUserId: otherId,
      subjectMessageId: reportTarget?.id,
      reason: reportReason,
      detail: reportDetail,
    });
    if (result) {
      setReportTarget(null);
      setReportDetail('');
      setNotice('Report submitted. Moderators review every report.');
    }
  };

  const handleVoiceNote = async () => {
    if (recorder.recording) {
      const note = await recorder.stop();
      if (!note) return;
      const transcription = await transcribeVoiceNote({
        uri: note.uri,
        mimeType: note.mimeType,
        languageHint: viewer?.languages[0],
      });
      const body =
        transcription.status === 'transcribed'
          ? transcription.text
          : `Voice note (${note.durationSeconds}s)`;
      if (transcription.status !== 'transcribed') {
        setNotice(
          `${transcription.reason} The voice note was still sent and its duration is shown to the recipient.`,
        );
      }
      // The waveform comes from the recording itself, through the native audio
      // module. When it cannot be produced the note is still sent and the
      // recipient sees the duration alone, so the reason is only surfaced if
      // there was no transcription notice already.
      const waveform = await voiceNoteWaveform(note.uri, note.mimeType);
      if (waveform.source === 'unavailable' && transcription.status === 'transcribed') {
        setNotice(waveform.reason ?? null);
      }
      await send.run({
        body,
        translateTo: null,
        voiceNoteSeconds: note.durationSeconds,
        waveform: waveform.bars.length > 0 ? waveform.bars : undefined,
      });
      return;
    }
    await recorder.start();
  };

  if (conversation.loading) return <LoadingState label="Opening conversation" />;

  if (!conversation.data) {
    return (
      <Screen>
        <EmptyState
          kind="error"
          title="Conversation unavailable"
          description="This conversation no longer exists, or you are no longer connected with this member."
          action={{ label: 'Go back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <View
        style={[
          styles.header,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
        ]}
      >
        <Pressable
          onPress={() => otherId && navigation.navigate('ProfileDetail', { userId: otherId })}
          accessibilityRole="button"
          accessibilityLabel={other.data ? `View ${other.data.displayName}'s profile` : 'View profile'}
          style={styles.headerIdentity}
        >
          <Avatar name={other.data?.displayName ?? 'Member'} uri={other.data?.avatarUrl} size={36} />
          <View style={styles.headerText}>
            <Text token="title3" numberOfLines={1}>
              {other.data?.displayName ?? 'Member'}
            </Text>
            <Text token="caption" tone="muted" numberOfLines={1}>
              {other.data?.languages.length
                ? other.data.languages.map(labelForLanguage).join(', ')
                : 'Languages not shared'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setShowTranslationPanel((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel="Translation options"
          style={styles.headerAction}
        >
          <Languages size={19} color={theme.colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      {showTranslationPanel ? (
        <View style={[styles.panel, { backgroundColor: theme.colors.surfaceSunken }]}>
          <View style={styles.panelHeader}>
            <Text token="label" tone="secondary">
              TRANSLATION
            </Text>
            <Pressable
              onPress={() => setShowTranslationPanel(false)}
              accessibilityRole="button"
              accessibilityLabel="Close translation options"
              hitSlop={8}
            >
              <X size={16} color={theme.colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <Text token="caption" tone="secondary">
            {translation.availability.available
              ? `Messages are translated into ${labelForLanguage(readerLanguage)} when a translation exists. You can ask for a translation per message from the composer.`
              : translation.availability.reason}
          </Text>
          <View style={styles.panelChips}>
            <Chip
              label={`Show in ${labelForLanguage(viewer?.languages[0] ?? 'en')}`}
              selected={overrideLanguage === null}
              onPress={() => setOverrideLanguage(null)}
            />
            {(other.data?.languages ?? []).map((code) => (
              <Chip
                key={code}
                label={`Show in ${labelForLanguage(code)}`}
                selected={overrideLanguage === code}
                onPress={() => setOverrideLanguage(code)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {notice ? (
        <View style={styles.notice}>
          <InlineMessage tone="info" message={notice} />
        </View>
      ) : null}
      {translation.error ? (
        <View style={styles.notice}>
          <InlineMessage tone="error" message={translation.error} />
        </View>
      ) : null}

      {reportTarget ? (
        <View style={styles.reportPanel}>
          <View style={styles.panelHeader}>
            <Text token="label" tone="secondary">
              REPORT MESSAGE
            </Text>
            <Pressable
              onPress={() => setReportTarget(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
              hitSlop={8}
            >
              <X size={16} color={theme.colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <Text token="caption" tone="secondary" numberOfLines={3}>
            “{reportTarget.body}”
          </Text>
          <View style={styles.panelChips}>
            {REPORT_REASONS.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={reportReason === item.id}
                onPress={() => setReportReason(item.id)}
              />
            ))}
          </View>
          <TextField
            label="What happened"
            value={reportDetail}
            onChangeText={setReportDetail}
            hint="Optional. Concrete detail helps moderators act."
            multiline
            numberOfLines={3}
            maxLength={600}
          />
          <Button label="Submit report" onPress={submitReport} loading={report.busy} fullWidth />
          {report.error ? <InlineMessage tone="error" message={report.error} /> : null}
        </View>
      ) : null}

      <FlatList
        data={decorated}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={item.senderId === user?.id}
            readerLanguage={readerLanguage}
            senderName={item.senderId === user?.id ? 'You' : (other.data?.displayName ?? 'Member')}
            onReport={() => setReportTarget(item)}
          />
        )}
        ListEmptyComponent={
          messages.loading ? (
            <LoadingState label="Loading messages" />
          ) : (
            <EmptyState
              kind="no-data"
              title="No messages yet"
              description={
                other.data
                  ? `Start with something specific from your shared interests. ${other.data.displayName} is already connected with you.`
                  : 'Send the first message to begin the conversation.'
              }
            />
          )
        }
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => undefined}
      />

      {recorder.recording ? (
        <View style={[styles.recording, { backgroundColor: theme.colors.surfaceSunken }]}>
          <Text token="bodyStrong" tone="danger">
            Recording {recorder.seconds}s / {ATTACHMENT_RULES.maxVoiceNoteSeconds}s
          </Text>
          <View style={styles.recordingActions}>
            <Button label="Send voice note" onPress={handleVoiceNote} />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={async () => {
                await recorder.cancel();
              }}
            />
          </View>
        </View>
      ) : null}

      {recorder.error ? (
        <View style={styles.notice}>
          <InlineMessage tone="error" message={recorder.error} />
        </View>
      ) : null}

      <MessageComposer
        sourceLanguage={viewer?.languages[0] ?? 'en'}
        targetLanguage={senderLanguage}
        translationAvailable={translation.availability.available}
        sending={send.busy}
        onSend={async (input) => {
          setNotice(null);
          await send.run(input);
        }}
        onRecordVoiceNote={handleVoiceNote}
        voiceNoteDisabledReason={
          recorder.permitted === false
            ? 'Microphone access was declined in Android settings.'
            : undefined
        }
        onAttach={() => {
          Alert.alert(
            'Attachments',
            'Attachment upload is enabled once Supabase Storage is configured. Validation rules (JPEG, PNG, WebP and common audio up to 8 MB) are already applied.',
          );
        }}
      />

      {isDemoMode ? (
        <Text token="caption" tone="muted" style={styles.demoNote}>
          Demo mode: messages are held in memory and the delivery states are simulated locally.
        </Text>
      ) : null}

      {send.error ? (
        <View style={styles.notice}>
          <InlineMessage tone="error" message={send.error} />
        </View>
      ) : null}

      <View style={styles.reportHint}>
        <Flag size={12} color={theme.colors.textMuted} strokeWidth={2} />
        <Text token="caption" tone="muted">
          Tap the icon beside any received message to report it.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    gap: spacing.md,
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
  },
  headerText: { flex: 1, gap: spacing.xxs },
  headerAction: {
    // Icon-only control in the header; the icon is 19px, so the target is
    // padded out to the app's minimum rather than left at icon size.
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { padding: spacing.lg, gap: spacing.md },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  panelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notice: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  reportPanel: {
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1 },
  recording: { padding: spacing.lg, gap: spacing.md },
  recordingActions: { flexDirection: 'row', gap: spacing.md },
  demoNote: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  reportHint: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyBox: { borderRadius: radius.md },
});
