import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Badge, LoadingState } from '../../components/ui/Chip';
import { DemoDataBanner } from '../../components/ui/Banners';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useConversations, useProfiles } from '../../hooks/useData';
import type { MessagesStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';
import { formatRelative, truncate } from '../../utils/format';
import type { Conversation } from '../../types/domain';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

/**
 * Conversation list.
 *
 * Only conversations between connected members appear here, because that is the
 * only way one can be created. Each row names the other participant rather than
 * storing a derived title.
 */
export function ConversationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user, isDemoMode, demoReason } = useAuth();
  const conversations = useConversations();
  const profiles = useProfiles();

  const nameFor = (conversation: Conversation): string => {
    const otherId = conversation.participantIds.find((id) => id !== user?.id);
    const other = profiles.data.find((profile) => profile.id === otherId);
    return other?.displayName ?? 'Converge member';
  };

  const avatarFor = (conversation: Conversation): string | null => {
    const otherId = conversation.participantIds.find((id) => id !== user?.id);
    return profiles.data.find((profile) => profile.id === otherId)?.avatarUrl ?? null;
  };

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.header}>
        <Text token="title1">Messages</Text>
        <Text token="caption" tone="secondary">
          Private messaging requires a connection you have both accepted.
        </Text>
      </View>

      <FlatList
        data={conversations.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={conversations.loading && conversations.data.length > 0}
            onRefresh={conversations.refresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
        )}
        ListHeaderComponent={
          isDemoMode && demoReason ? (
            <View style={styles.banner}>
              <DemoDataBanner message={demoReason} />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${nameFor(item)}${
              item.unreadCount > 0 ? `, ${item.unreadCount} unread` : ''
            }`}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent' },
            ]}
          >
            <Avatar name={nameFor(item)} uri={avatarFor(item)} size={46} />
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text token="bodyStrong" numberOfLines={1} style={styles.name}>
                  {nameFor(item)}
                </Text>
                <Text token="caption" tone="muted">
                  {item.lastMessageAt ? formatRelative(item.lastMessageAt) : ''}
                </Text>
              </View>
              <Text token="caption" tone={item.unreadCount > 0 ? 'primary' : 'secondary'} numberOfLines={1}>
                {item.lastMessagePreview ? truncate(item.lastMessagePreview, 72) : 'No messages yet'}
              </Text>
            </View>
            {item.unreadCount > 0 ? <Badge count={item.unreadCount} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          conversations.loading ? (
            <LoadingState label="Loading conversations" />
          ) : conversations.error ? (
            <EmptyState
              kind="error"
              title="Could not load conversations"
              description={conversations.error}
              action={{ label: 'Try again', onPress: conversations.refresh }}
            />
          ) : (
            <EmptyState
              kind="no-data"
              title="No conversations yet"
              description="Conversations open after you accept a connection request, or when someone you are connected with messages you."
              action={{
                label: 'Find people to connect with',
                onPress: () =>
                  navigation.getParent()?.navigate('Discover', { screen: 'DiscoverHome' }),
              }}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },
  banner: { paddingBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, gap: spacing.xxs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth * 2, marginLeft: 62 },
});
