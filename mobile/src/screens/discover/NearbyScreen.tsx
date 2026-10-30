import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Compass, MapPin, Navigation, ShieldCheck, Users } from 'lucide-react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Avatar, Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Card, Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { FadeIn } from '../../components/motion';
import { useLocation } from '../../context/LocationContext';
import { useTheme } from '../../context/ThemeContext';
import { useNearbyCommunities, useNearbyPeople } from '../../hooks/useData';
import { MIN_TOUCH_TARGET, spacing, radius } from '../../theme';
import type { NearbyStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Nearby Network.
 *
 * Members and communities in the same rough area as the viewer. Two things are
 * deliberately visible in this screen:
 *
 *   * the search area, named and shown, so it is never ambiguous what "nearby"
 *     is measured from;
 *   * the coarse radius, and the fact that distances are approximate, so nobody
 *     reads a distance here as a position.
 *
 * Members appear only if they opted in. When nobody has, the empty state says so
 * plainly rather than implying a loading failure.
 */

type Props = NativeStackScreenProps<NearbyStackParamList, 'NearbyHome'>;

/** Offered radii. Below 5 km the coarse grid makes the number meaningless. */
const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

export function NearbyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { area, source, permission, loading, error, requestDeviceArea } = useLocation();
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [tab, setTab] = useState<'people' | 'communities'>('people');

  const people = useNearbyPeople(radiusKm);
  const communities = useNearbyCommunities(radiusKm);

  // The area label is what the member recognises; the city is the fallback when
  // reverse geocoding had no neighbourhood name.
  const areaLabel = area ? (area.areaLabel ?? area.city ?? 'Your area') : null;

  const radiusChips = useMemo(
    () =>
      RADIUS_OPTIONS.map((option) => ({
        label: `${option} km`,
        selected: option === radiusKm,
        onPress: () => setRadiusKm(option),
      })),
    [radiusKm],
  );

  const requestLocation = async () => {
    const outcome = await requestDeviceArea();
    if (outcome.status === 'denied') {
      // A denial is recoverable through system settings, so the message points
      // there instead of repeating the request.
      return;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text token="title1">Nearby Network</Text>
      <Text token="body" tone="secondary" style={styles.lede}>
        Members and communities who have chosen to be discoverable in their area.
      </Text>

      <Card style={styles.areaCard}>
        <View style={styles.areaRow}>
          <View style={[styles.areaIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <MapPin size={18} color={theme.colors.accent} strokeWidth={2} />
          </View>
          <View style={styles.areaText}>
            <Text token="label" tone="secondary">
              SEARCHING AROUND
            </Text>
            <Text token="title3">{areaLabel ?? 'No area set'}</Text>
            {area ? null : (
              <Text token="caption" tone="muted">
                Share your approximate area, or search for a city, to see who is around.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.areaActions}>
          <Button
            label={area ? 'Update my area' : 'Use my location'}
            variant={area ? 'secondary' : 'primary'}
            icon={
              <Navigation
                size={16}
                color={area ? theme.colors.textPrimary : theme.colors.onPrimary}
                strokeWidth={2}
              />
            }
            onPress={requestLocation}
            loading={loading}
            style={styles.areaButton}
          />
          <Button
            label="Search a city"
            variant="ghost"
            onPress={() => navigation.navigate('LocationPicker')}
            style={styles.areaButton}
          />
        </View>

        {area ? (
          <View style={styles.assurance}>
            <ShieldCheck size={14} color={theme.colors.success} strokeWidth={2.2} />
            <Text token="caption" tone="secondary" style={styles.assuranceText}>
              Approximate area only. Converge never stores your exact position.
            </Text>
          </View>
        ) : null}

        {error ? <InlineMessage tone="info" message={error} /> : null}
        {!error && permission === 'denied' ? (
          <InlineMessage
            tone="info"
            message="Location permission is off. You can still search for a city to explore a place."
          />
        ) : null}
        {source === 'manual' ? (
          <Text token="caption" tone="muted">
            Using the city you chose. Tap “Use my location” to switch to your device area.
          </Text>
        ) : null}
      </Card>

      {area ? (
        <>
          <View style={styles.radiusRow}>
            {radiusChips.map((chip) => (
              <Chip
                key={chip.label}
                label={chip.label}
                selected={chip.selected}
                onPress={chip.onPress}
              />
            ))}
          </View>

          <View style={[styles.tabs, { borderColor: theme.colors.border }]}>
            <TabButton
              label="People"
              count={people.data.length}
              active={tab === 'people'}
              onPress={() => setTab('people')}
            />
            <TabButton
              label="Communities"
              count={communities.data.length}
              active={tab === 'communities'}
              onPress={() => setTab('communities')}
            />
          </View>
        </>
      ) : null}
    </View>
  );

  if (!area) {
    return (
      <Screen padded={false} edges={['top']}>
        <View style={styles.header}>
          <Text token="title1">Nearby Network</Text>
        </View>
        <EmptyState
          kind="no-data"
          art="search"
          title="Tell Converge where to look"
          description="Nearby Network shows members and communities who opted into discovery in a rough area. Share your device area, or search for a city if you would rather not."
          action={{ label: 'Use my location', onPress: requestLocation }}
          secondaryAction={{
            label: 'Search a city instead',
            onPress: () => navigation.navigate('LocationPicker'),
          }}
        />
      </Screen>
    );
  }

  if (tab === 'people') {
    return (
      <Screen padded={false} edges={['top']}>
        <FlatList
          data={people.data}
          keyExtractor={(item) => item.profile.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={people.loading && people.data.length > 0}
              onRefresh={people.refresh}
              tintColor={theme.colors.accent}
            />
          }
          ListEmptyComponent={
            // `undefined` rather than `null`: an empty component is allowed to
            // be absent, but this React Native version does not accept null.
            people.loading ? undefined : people.error ? (
              <EmptyState
                kind="error"
                title="Could not load nearby members"
                description={people.error}
                action={{ label: 'Try again', onPress: people.refresh }}
              />
            ) : (
              <EmptyState
                kind="no-results"
                art="people"
                title={`Nobody nearby within ${radiusKm} km`}
                description="Members only appear here if they opted into nearby discovery. Widening the radius may help, or explore by shared interest instead."
                action={{
                  label: 'Discover by interest',
                  onPress: () => navigation.getParent()?.navigate('Discover'),
                }}
              />
            )
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={Math.min(index * 40, 240)}>
              <Pressable
                onPress={() => navigation.navigate('ProfileDetail', { userId: item.profile.id })}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.profile.displayName}, about ${item.distanceKm} kilometres away`}
                style={[
                  styles.personCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Avatar name={item.profile.displayName} uri={item.profile.avatarUrl} size={48} />
                <View style={styles.personText}>
                  <Text token="title3" numberOfLines={1}>
                    {item.profile.displayName}
                  </Text>
                  <Text token="caption" tone="secondary" numberOfLines={1}>
                    {item.profile.headline ?? 'No headline yet'}
                  </Text>
                  <View style={styles.metaRow}>
                    <Compass size={13} color={theme.colors.textMuted} strokeWidth={2} />
                    <Text token="caption" tone="muted">
                      {item.profile.location?.areaLabel ?? 'Nearby'} · approx. {item.distanceKm} km
                    </Text>
                  </View>
                </View>
              </Pressable>
            </FadeIn>
          )}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={communities.data}
        keyExtractor={(item) => item.community.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={communities.loading && communities.data.length > 0}
            onRefresh={communities.refresh}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          communities.loading ? undefined : communities.error ? (
            <EmptyState
              kind="error"
              title="Could not load nearby communities"
              description={communities.error}
              action={{ label: 'Try again', onPress: communities.refresh }}
            />
          ) : (
            <EmptyState
              kind="no-results"
              art="communities"
              title={`No communities within ${radiusKm} km`}
              description="Communities appear here once an organiser records their area. You can browse all communities instead."
              action={{
                label: 'Browse communities',
                onPress: () => navigation.getParent()?.navigate('Communities'),
              }}
            />
          )
        }
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index * 40, 240)}>
            <Pressable
              onPress={() =>
                navigation.navigate('CommunityDetail', { communityId: item.community.id })
              }
              accessibilityRole="button"
              accessibilityLabel={`View ${item.community.name}, about ${item.distanceKm} kilometres away`}
              style={[
                styles.communityCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={[styles.communityMark, { backgroundColor: item.community.coverColour }]}>
                <Users size={18} color="#FFFFFF" strokeWidth={2} />
              </View>
              <View style={styles.personText}>
                <Text token="title3" numberOfLines={1}>
                  {item.community.name}
                </Text>
                <Text token="caption" tone="secondary" numberOfLines={2}>
                  {item.community.purpose}
                </Text>
                <View style={styles.metaRow}>
                  <MapPin size={13} color={theme.colors.textMuted} strokeWidth={2} />
                  <Text token="caption" tone="muted">
                    {item.community.location?.areaLabel ?? 'Nearby'} · approx. {item.distanceKm} km
                  </Text>
                </View>
              </View>
            </Pressable>
          </FadeIn>
        )}
      />
    </Screen>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count}${active ? ', showing' : ''}`}
      style={[
        styles.tab,
        active && { borderBottomColor: theme.colors.accent, borderBottomWidth: 2 },
      ]}
    >
      <Text token="title3" tone={active ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <View
        style={[
          styles.tabCount,
          {
            backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceSunken,
            borderColor: active ? theme.colors.accent : theme.colors.border,
          },
        ]}
      >
        <Text token="caption" tone={active ? 'accent' : 'muted'}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  lede: { marginTop: -spacing.sm },
  areaCard: { gap: spacing.md },
  areaRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  areaIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaText: { flex: 1, gap: 2 },
  areaActions: { flexDirection: 'row', gap: spacing.sm },
  areaButton: { flex: 1 },
  radiusRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth * 2, gap: spacing.xl },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // The strip is the primary way to move between the two lists, so each tab
    // is a full-height target rather than the height of its text.
    minHeight: MIN_TOUCH_TARGET,
    paddingBottom: spacing.sm,
  },
  tabCount: {
    minWidth: 26,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assurance: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assuranceText: { flex: 1 },
  list: { paddingBottom: spacing.xl * 2 },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  communityMark: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personText: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
});
