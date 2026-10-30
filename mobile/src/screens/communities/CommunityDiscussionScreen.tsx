import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SendHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, LoadingState } from '../../components/ui/Chip';
import { InlineMessage } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCommunityMessages, useMutation, useProfiles } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme';
import { formatRelative } from '../../utils/format';
import { MAX_MESSAGE_LENGTH, validateOutgoingMessage } from '../../utils/validation';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'CommunityDiscussion'>;

/**
 * Group discussion.
 *
 * Members of a community can post here. The repository enforces membership, so
 * this screen never needs to gate the composer itself — it reports the failure
 * if posting is refused.
 */
export function CommunityDiscussionScreen({ route }: Props) {
  const { theme } = useTheme();
  const { communityId } = route.params;
  const { user } = useAuth();
  const messages = useCommunityMessages(communityId);
  const profiles = useProfiles();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const post = useMutation(
    useCallback(async (body: string) => repository().postCommunityMessage(communityId, body), [
      communityId,
    ]),
  );

  useEffect(() => {
    if (!communityId) return;
    return repository().onMessageInsert(communityId, (message) => {
      messages.setData((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
    });
  }, [communityId, messages]);

  const nameFor = (senderId: string) =>
    profiles.data.find((profile) => profile.id === senderId)?.displayName ?? 'Member';

  const avatarFor = (senderId: string) =>
    profiles.data.find((profile) => profile.id === senderId)?.avatarUrl ?? null;

  const submit = async () => {
    const validation = validateOutgoingMessage(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    const body = draft.trim();
    setDraft('');
    const result = await post.run(body);
    if (!result) {
      setDraft(body);
      return;
    }
    messages.setData((current) =>
      current.some((item) => item.id === result.id) ? current : [...current, result],
    );
  };

  return (
    <Screen padded={false} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text token="title2">Group discussion</Text>
          <Text token="caption" tone="secondary">
            Everyone in this community can read and post here. Be specific and stay on topic.
          </Text>
        </View>

        {error || post.error ? (
          <View style={styles.notice}>
            <InlineMessage tone="error" message={error ?? post.error ?? ''} />
          </View>
        ) : null}

        <FlatList
          data={messages.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={styles.message}>
                <Avatar name={nameFor(item.senderId)} uri={avatarFor(item.senderId)} size={34} />
                <View style={styles.messageBody}>
                  <View style={styles.messageMeta}>
                    <Text token="caption" color={mine ? theme.colors.accent : theme.colors.textPrimary}>
                      {mine ? 'You' : nameFor(item.senderId)}
                    </Text>
                    <Text token="caption" tone="muted">
                      {formatRelative(item.createdAt)}
                    </Text>
                  </View>
                  <Text token="body" tone="secondary">
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            messages.loading ? (
              <LoadingState label="Loading discussion" />
            ) : (
              <EmptyState
                kind="no-data"
                title="No messages in this discussion"
                description="Start it with a question or a short update. Specific openings get replies."
              />
            )
          }
        />

        <View
          style={[
            styles.composer,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (error) setError(null);
            }}
            placeholder="Post to the group discussion"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            accessibilityLabel="Discussion message"
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
          <Pressable
            onPress={submit}
            disabled={post.busy || draft.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Post message"
            accessibilityState={{ disabled: post.busy || draft.trim().length === 0 }}
            style={[
              styles.send,
              {
                backgroundColor: theme.colors.primary,
                opacity: post.busy || draft.trim().length === 0 ? 0.45 : 1,
              },
            ]}
          >
            <SendHorizontal size={18} color={theme.colors.onPrimary} strokeWidth={2.2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  notice: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1, gap: spacing.lg },
  message: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  messageBody: { flex: 1, gap: spacing.xxs },
  messageMeta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  send: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
