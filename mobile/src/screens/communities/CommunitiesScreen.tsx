import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, Plus, QrCode, Search, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { DemoDataBanner } from '../../components/ui/Banners';
import { LoadingState } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { SearchField } from '../../components/ui/TextField';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { CommunityCard, EventCard } from '../../features/community/CommunityCard';
import { useCommunities, useEvents, useMemberships } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import type { Community, CommunityEvent } from '../../types/domain';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'CommunitiesHome'>;

type Tab = 'communities' | 'mine' | 'events';

/** One row in the list; the union keeps the two card kinds type-safe. */
type Row =
  | { kind: 'community'; key: string; community: Community }
  | { kind: 'event'; key: string; event: CommunityEvent };

/**
 * Communities, events and membership in one place.
 *
 * The three tabs answer the three questions this part of the product has to
 * answer: what exists, what am I part of, and what is happening soon.
 */
export function CommunitiesScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isDemoMode, demoReason } = useAuth();
  const [tab, setTab] = useState<Tab>('communities');
  const [search, setSearch] = useState('');

  const communities = useCommunities({ search });
  const mine = useCommunities({ joinedOnly: true });
  const memberships = useMemberships();
  const events = useEvents();

  const membershipState = useMemo(() => {
    const map = new Map<string, 'none' | 'requested' | 'invited' | 'member'>();
    for (const item of memberships.data) map.set(item.communityId, item.state);
    return map;
  }, [memberships.data]);

  const communityNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of [...communities.data, ...mine.data]) map.set(item.id, item.name);
    return map;
  }, [communities.data, mine.data]);

  const upcoming = useMemo(
    () => [...events.data].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events.data],
  );

  const refreshing =
    (communities.loading || mine.loading || events.loading) &&
    communities.data.length + mine.data.length + events.data.length > 0;

  const refreshAll = () => {
    void communities.refresh();
    void mine.refresh();
    void memberships.refresh();
    void events.refresh();
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.heading}>
        <Text token="title1">Communities</Text>
        <Text token="caption" tone="secondary">
          Communities are the shared context behind every recommendation. Membership is always
          visible to organisers, never your exact location.
        </Text>
      </View>

      <View style={styles.quickActions}>
        <Pressable
          onPress={() => navigation.navigate('JoinByCode')}
          accessibilityRole="button"
          accessibilityLabel="Join a community with a code"
          style={[styles.quick, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <QrCode size={16} color={theme.colors.textPrimary} strokeWidth={2} />
          <Text token="caption">Join with a code</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('CreateCommunity')}
          accessibilityRole="button"
          accessibilityLabel="Create a community"
          style={[styles.quick, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <Plus size={16} color={theme.colors.textPrimary} strokeWidth={2} />
          <Text token="caption">Create</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'communities', label: 'Browse', Icon: Search },
            { id: 'mine', label: 'My communities', Icon: Users },
            { id: 'events', label: 'Events', Icon: CalendarDays },
          ] as const
        ).map(({ id, label, Icon }) => {
          const selected = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? theme.colors.primary : 'transparent',
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Icon
                size={14}
                color={selected ? theme.colors.onPrimary : theme.colors.textSecondary}
                strokeWidth={2}
              />
              <Text
                token="caption"
                color={selected ? theme.colors.onPrimary : theme.colors.textSecondary}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'communities' ? (
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search communities by name or purpose"
          accessibilityLabel="Search communities"
        />
      ) : null}

      {isDemoMode && demoReason ? <DemoDataBanner message={demoReason} /> : null}
    </View>
  );

  const data: Row[] =
    tab === 'communities' || tab === 'mine'
      ? (tab === 'communities' ? communities.data : mine.data).map((community) => ({
          kind: 'community',
          key: `c-${community.id}`,
          community,
        }))
      : upcoming.map((event) => ({ kind: 'event', key: `e-${event.id}`, event }));

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'community' ? (
            <CommunityCard
              community={item.community}
              membershipState={membershipState.get(item.community.id) ?? 'none'}
              onPress={() => navigation.navigate('CommunityDetail', { communityId: item.community.id })}
            />
          ) : (
            <EventCard
              event={item.event}
              communityName={communityNames.get(item.event.communityId)}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.event.id })}
            />
          )
        }
        ListEmptyComponent={
          communities.loading || events.loading ? (
            <LoadingState label="Loading communities" />
          ) : tab === 'mine' ? (
            <EmptyState
              kind="no-data"
              title="You have not joined a community yet"
              description="Communities give matching its context: shared groups produce stronger, more explainable recommendations."
              action={{ label: 'Browse communities', onPress: () => setTab('communities') }}
            />
          ) : tab === 'events' ? (
            <EmptyState
              kind="no-data"
              title="No upcoming events"
              description="Events are created by community organisers. Join a community to see its schedule."
              action={{ label: 'Browse communities', onPress: () => setTab('communities') }}
            />
          ) : search ? (
            <EmptyState
              kind="no-results"
              title="No communities match that search"
              description="Try a different term, or create the community you are looking for."
              action={{ label: 'Clear search', onPress: () => setSearch('') }}
            />
          ) : (
            <EmptyState
              kind="no-data"
              title="No communities yet"
              description="Be the first: create a community for an interest, skill or goal you care about."
              action={{ label: 'Create a community', onPress: () => navigation.navigate('CreateCommunity') }}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  heading: { gap: spacing.xs },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: MIN_TOUCH_TARGET,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: MIN_TOUCH_TARGET,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },
  separator: { height: spacing.md },
});
