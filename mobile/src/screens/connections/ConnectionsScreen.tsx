import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, MessageSquareText, UserMinus, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Chip, LoadingState } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useConnections, useMutation, useProfiles } from '../../hooks/useData';
import type { ConnectionsStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';
import { formatRelative } from '../../utils/format';

type Props = NativeStackScreenProps<ConnectionsStackParamList, 'ConnectionsHome'>;

type Tab = 'incoming' | 'outgoing' | 'connections';

/** One row in the list; the union keeps each request state type-safe. */
type Row =
  | { kind: 'incoming'; key: string; id: string; userId: string; reason: string | null; createdAt: string }
  | { kind: 'outgoing'; key: string; id: string; userId: string; reason: string | null; createdAt: string }
  | { kind: 'connection'; key: string; id: string; userId: string; reason: null; createdAt: string };

/**
 * Connections.
 *
 * Three tabs mirror the three states of the connection model: requests you have
 * received, requests you have sent, and the connections that exist. Only the
 * third state permits messaging, which the empty states say explicitly.
 */
export function ConnectionsScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const connections = useConnections();
  const profiles = useProfiles();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'incoming');
  const [notice, setNotice] = useState<string | null>(null);

  const profileFor = useCallback(
    (userId: string) => profiles.data.find((profile) => profile.id === userId) ?? null,
    [profiles.data],
  );

  const respond = useMutation(
    useCallback(
      async (requestId: string, decision: 'accept' | 'decline') =>
        repository().respondToRequest(requestId, decision),
      [],
    ),
  );

  const cancel = useMutation(
    useCallback(async (requestId: string) => repository().cancelRequest(requestId), []),
  );

  const remove = useMutation(
    useCallback(async (connectionId: string) => repository().removeConnection(connectionId), []),
  );

  const openChat = useMutation(
    useCallback(
      async (otherUserId: string) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().openDirectConversation(user.id, otherUserId);
      },
      [user],
    ),
  );

  const counts = useMemo(
    () => ({
      incoming: connections.data.incoming.length,
      outgoing: connections.data.outgoing.length,
      connections: connections.data.connections.length,
    }),
    [connections.data],
  );

  const refreshAll = () => {
    void connections.refresh();
    void profiles.refresh();
  };

  const rows = useMemo<Row[]>(() => {
    if (tab === 'incoming') {
      return connections.data.incoming.map((request) => ({
        kind: 'incoming',
        key: `in-${request.id}`,
        id: request.id,
        userId: request.fromUserId,
        reason: request.reason,
        createdAt: request.createdAt,
      }));
    }
    if (tab === 'outgoing') {
      return connections.data.outgoing.map((request) => ({
        kind: 'outgoing',
        key: `out-${request.id}`,
        id: request.id,
        userId: request.toUserId,
        reason: request.reason,
        createdAt: request.createdAt,
      }));
    }
    return connections.data.connections.map((connection) => ({
      kind: 'connection',
      key: `con-${connection.id}`,
      id: connection.id,
      userId: connection.userId,
      reason: null,
      createdAt: connection.connectedAt,
    }));
  }, [connections.data, tab]);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.header}>
        <Text token="title1">Connections</Text>
        <Text token="caption" tone="secondary">
          Messaging opens only after a request is accepted by both people. Nothing here is ever
          sent without your agreement.
        </Text>

        <View style={styles.tabs}>
          {(
            [
              { id: 'incoming', label: 'Received' },
              { id: 'outgoing', label: 'Sent' },
              { id: 'connections', label: 'Connected' },
            ] as const
          ).map(({ id, label }) => {
            const selected = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label}, ${counts[id]} items`}
                style={[
                  styles.tab,
                  {
                    backgroundColor: selected ? theme.colors.primary : 'transparent',
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  token="caption"
                  color={selected ? theme.colors.onPrimary : theme.colors.textSecondary}
                >
                  {label}
                </Text>
                <Text
                  token="label"
                  color={selected ? theme.colors.onPrimary : theme.colors.textMuted}
                >
                  {counts[id]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {notice ? <InlineMessage tone="success" message={notice} /> : null}
        {respond.error ? <InlineMessage tone="error" message={respond.error} /> : null}
        {openChat.error ? <InlineMessage tone="error" message={openChat.error} /> : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={connections.loading && rows.length > 0}
            onRefresh={refreshAll}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        renderItem={({ item }) => {
          const profile = profileFor(item.userId);
          const name = profile?.displayName ?? 'Converge member';
          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Pressable
                onPress={() =>
                  navigation.navigate('ProfileDetail', { userId: item.userId })
                }
                accessibilityRole="button"
                accessibilityLabel={`View ${name}'s profile`}
                style={styles.identity}
              >
                <Avatar name={name} uri={profile?.avatarUrl} size={44} />
                <View style={styles.identityText}>
                  <Text token="title3" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text token="caption" tone="secondary" numberOfLines={1}>
                    {profile?.headline ?? 'No headline yet'}
                  </Text>
                  <Text token="caption" tone="muted">
                    {item.kind === 'connection' ? 'Connected' : 'Requested'}{' '}
                    {formatRelative(item.createdAt)}
                  </Text>
                </View>
              </Pressable>

              {item.reason ? (
                <View
                  style={[
                    styles.reason,
                    { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
                  ]}
                >
                  <Text token="caption" tone="secondary">
                    “{item.reason}”
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                {item.kind === 'incoming' ? (
                  <>
                    <Button
                      label="Accept"
                      onPress={async () => {
                        const result = await respond.run(item.id, 'accept');
                        if (result) {
                          setNotice(`You are now connected with ${name}.`);
                          refreshAll();
                        }
                      }}
                      icon={<Check size={16} color={theme.colors.onPrimary} strokeWidth={2.4} />}
                      style={styles.action}
                    />
                    <Button
                      label="Decline"
                      variant="secondary"
                      onPress={async () => {
                        const result = await respond.run(item.id, 'decline');
                        if (result) {
                          setNotice(`Request from ${name} declined.`);
                          refreshAll();
                        }
                      }}
                      icon={<X size={16} color={theme.colors.textPrimary} strokeWidth={2.4} />}
                      style={styles.action}
                    />
                  </>
                ) : item.kind === 'outgoing' ? (
                  <Button
                    label="Cancel request"
                    variant="secondary"
                    onPress={async () => {
                      await cancel.run(item.id);
                      setNotice('Request cancelled.');
                      refreshAll();
                    }}
                    fullWidth
                  />
                ) : (
                  <>
                    <Button
                      label="Message"
                      onPress={async () => {
                        const conversation = await openChat.run(item.userId);
                        if (conversation) {
                          navigation.navigate('Chat', { conversationId: conversation.id });
                        }
                      }}
                      icon={
                        <MessageSquareText size={16} color={theme.colors.onPrimary} strokeWidth={2} />
                      }
                      style={styles.action}
                    />
                    <Button
                      label="Remove"
                      variant="secondary"
                      onPress={() =>
                        Alert.alert(
                          `Remove ${name}?`,
                          'You will no longer be connected, and the conversation will close. You can send a new request later.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: async () => {
                                await remove.run(item.id);
                                setNotice(`${name} removed from your connections.`);
                                refreshAll();
                              },
                            },
                          ],
                        )
                      }
                      icon={<UserMinus size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
                      style={styles.action}
                    />
                  </>
                )}
              </View>

              {item.kind === 'connection' ? (
                <View style={styles.chipRow}>
                  <Chip label="Messaging open" readOnly tone="accent" />
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          connections.loading ? (
            <LoadingState label="Loading connections" />
          ) : connections.error ? (
            <EmptyState
              kind="error"
              title="Could not load connections"
              description={connections.error}
              action={{ label: 'Try again', onPress: connections.refresh }}
            />
          ) : tab === 'incoming' ? (
            <EmptyState
              kind="no-data"
              title="No requests received"
              description="When someone asks to connect, their request and any reason they gave appear here for you to accept or decline."
            />
          ) : tab === 'outgoing' ? (
            <EmptyState
              kind="no-data"
              title="No requests sent"
              description="Requests you send appear here until the other person responds. You can cancel any pending request."
              action={{
                label: 'Find people to connect with',
                onPress: () =>
                  navigation.getParent()?.navigate('Discover', { screen: 'DiscoverHome' }),
              }}
            />
          ) : (
            <EmptyState
              kind="no-data"
              title="No connections yet"
              description="Accept a request or send one of your own. Messaging opens as soon as you are connected."
              action={{
                label: 'See recommendations',
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 46,
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },
  separator: { height: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.md,
  },
  identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  identityText: { flex: 1, gap: spacing.xxs },
  reason: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
});
