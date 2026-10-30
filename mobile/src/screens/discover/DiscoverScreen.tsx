import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ConvergeMark } from '../../components/brand/ConvergeMark';
import { DemoDataBanner, FeatureUnavailable } from '../../components/ui/Banners';
import { Chip, LoadingState } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { SearchField } from '../../components/ui/TextField';
import { aiUnavailableReason } from '../../constants/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMatches } from '../../hooks/useData';
import { useLocation } from '../../context/LocationContext';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  type DiscoverFilters,
} from '../../features/matching/engine';
import { MatchCard } from '../../features/matching/MatchCard';
import type { DiscoverStackParamList } from '../../navigation/types';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../theme';
import type { MatchResult } from '../../types/domain';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'DiscoverHome'>;

/**
 * Discover: the start of the core journey.
 *
 * Ranked, explained recommendations come first. Each card states why the person
 * is worth contacting and offers the two next steps that matter: read the full
 * explanation, or practise what to say.
 */
export function DiscoverScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { profile, isDemoMode, demoReason } = useAuth();
  const { area, source } = useLocation();
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const matches = useMatches(filters);

  // The filters screen applies its result by navigating back with params, which
  // keeps filter state in one place instead of duplicating it across screens.
  // Adjusting state during render, rather than in an effect, avoids a second
  // render pass with the stale filter set.
  const appliedFilters = route.params?.filters;
  const [lastApplied, setLastApplied] = useState(appliedFilters);
  if (lastApplied !== appliedFilters) {
    setLastApplied(appliedFilters);
    if (appliedFilters) setFilters(appliedFilters);
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return matches.data;
    return matches.data.filter((result) => {
      const { profile: candidate } = result;
      return (
        candidate.displayName.toLowerCase().includes(needle) ||
        (candidate.headline?.toLowerCase().includes(needle) ?? false) ||
        candidate.interests.some((id) => id.replace(/-/g, ' ').includes(needle))
      );
    });
  }, [matches.data, search]);

  const filterCount = activeFilterCount(filters);

  const renderItem = useCallback(
    ({ item }: { item: MatchResult }) => (
      <MatchCard
        result={item}
        onPress={() => navigation.navigate('ProfileDetail', { userId: item.profile.id })}
        footer={
          <View style={styles.cardActions}>
            <Pressable
              onPress={() => navigation.navigate('ProfileDetail', { userId: item.profile.id })}
              accessibilityRole="button"
              accessibilityLabel={`See why ${item.profile.displayName} is recommended`}
              style={[styles.action, { borderColor: theme.colors.border }]}
            >
              <Text token="caption">Why this match</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Coach')}
              accessibilityRole="button"
              accessibilityLabel={`Practise what to say to ${item.profile.displayName} before sending`}
              style={[styles.action, { borderColor: theme.colors.border }]}
            >
              <Text token="caption">Practise first</Text>
            </Pressable>
          </View>
        }
      />
    ),
    [navigation, theme.colors.border],
  );

  const areaLabel = area ? (area.areaLabel ?? area.city ?? 'your area') : null;

  if (!profile) return <LoadingState label="Preparing discovery" />;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <ConvergeMark size={26} stroke={theme.colors.primary} node={theme.colors.accent} />
            <Text token="title2">Discover</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Filters')}
            accessibilityRole="button"
            accessibilityLabel={
              filterCount > 0 ? `Filters, ${filterCount} active` : 'Open filters'
            }
            style={[
              styles.filterButton,
              {
                backgroundColor: filterCount > 0 ? theme.colors.primary : theme.colors.surface,
                borderColor: filterCount > 0 ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <SlidersHorizontal
              size={16}
              color={filterCount > 0 ? theme.colors.onPrimary : theme.colors.textPrimary}
              strokeWidth={2}
            />
            <Text
              token="caption"
              color={filterCount > 0 ? theme.colors.onPrimary : theme.colors.textPrimary}
            >
              {filterCount > 0 ? `Filters · ${filterCount}` : 'Filters'}
            </Text>
          </Pressable>
        </View>

        {/* Where recommendations are drawn from. Stating the area here means a
            member never has to guess why someone appeared, and it gives the one
            obvious route to widen the search. */}
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Nearby')}
          accessibilityRole="button"
          accessibilityLabel={
            area ? `Searching near ${areaLabel}. Change area` : 'Choose a search area'
          }
          style={[
            styles.contextRow,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <MapPin size={15} color={theme.colors.accent} strokeWidth={2.1} />
          <Text token="caption" tone="secondary" style={styles.contextText} numberOfLines={1}>
            {area
              ? `Near ${areaLabel}${source === 'manual' ? ' · chosen area' : ''}`
              : 'No search area set · showing everyone'}
          </Text>
          <Text token="caption" tone="accent">
            {area ? 'Change' : 'Set area'}
          </Text>
        </Pressable>

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, headline or interest"
          accessibilityLabel="Search members"
        />

        {filterCount > 0 ? (
          <View style={styles.activeFilters}>
            {filters.openToConversationsOnly ? (
              <Chip
                label="Open to conversations"
                selected
                onPress={() =>
                  setFilters((current) => ({ ...current, openToConversationsOnly: false }))
                }
              />
            ) : null}
            {filters.sharedCommunitiesOnly ? (
              <Chip
                label="Shared communities"
                selected
                onPress={() =>
                  setFilters((current) => ({ ...current, sharedCommunitiesOnly: false }))
                }
              />
            ) : null}
            {filters.maxDistanceKm !== null ? (
              <Chip
                label={`Within ${filters.maxDistanceKm} km`}
                selected
                onPress={() => setFilters((current) => ({ ...current, maxDistanceKm: null }))}
              />
            ) : null}
            {filters.interestIds.length > 0 ? (
              <Chip
                label={`${filters.interestIds.length} interests`}
                selected
                onPress={() => setFilters((current) => ({ ...current, interestIds: [] }))}
              />
            ) : null}
            {filters.languageCodes.length > 0 ? (
              <Chip
                label={`${filters.languageCodes.length} languages`}
                selected
                onPress={() => setFilters((current) => ({ ...current, languageCodes: [] }))}
              />
            ) : null}
            {filters.goalIds.length > 0 ? (
              <Chip
                label={`${filters.goalIds.length} goals`}
                selected
                onPress={() => setFilters((current) => ({ ...current, goalIds: [] }))}
              />
            ) : null}
            {filters.activityIds.length > 0 ? (
              <Chip
                label={`${filters.activityIds.length} activities`}
                selected
                onPress={() => setFilters((current) => ({ ...current, activityIds: [] }))}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.profile.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={matches.loading && matches.data.length > 0}
            onRefresh={matches.refresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {isDemoMode && demoReason ? <DemoDataBanner message={demoReason} /> : null}
            {aiUnavailableReason ? (
              <FeatureUnavailable
                title="Conversation coach is offline"
                reason={aiUnavailableReason}
                remedy="Set EXPO_PUBLIC_BACKEND_URL in mobile/.env"
              />
            ) : null}
            {filtered.length > 0 ? (
              <View style={styles.resultStrip}>
                <Text token="label" tone="muted">
                  {filtered.length}{' '}
                  {filtered.length === 1 ? 'RECOMMENDATION' : 'RECOMMENDATIONS'}
                </Text>
                <Text token="caption" tone="muted">
                  Ranked by shared signal, strongest first
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          matches.loading ? (
            <LoadingState label="Scoring recommendations" />
          ) : matches.error ? (
            <EmptyState
              kind="error"
              title="Could not load recommendations"
              description={matches.error}
              action={{ label: 'Try again', onPress: matches.refresh }}
            />
          ) : search ? (
            <EmptyState
              kind="no-results"
              title="No members match that search"
              description="Try a different name or clear the search field."
              action={{ label: 'Clear search', onPress: () => setSearch('') }}
            />
          ) : filterCount > 0 ? (
            <EmptyState
              kind="no-results"
              title="No members match these filters"
              description="Filters are applied on top of matching. Relax one to widen the results."
              action={{ label: 'Clear filters', onPress: () => setFilters(EMPTY_FILTERS) }}
            />
          ) : (
            <EmptyState
              kind="no-data"
              title="No recommendations yet"
              description="AuraMatch needs a little more to work with. Add interests, a goal and the skills you can offer."
              action={{
                label: 'Edit my profile',
                onPress: () =>
                  navigation.getParent()?.navigate('Profile', { screen: 'EditProfile' }),
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  contextText: { flex: 1 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: MIN_TOUCH_TARGET,
  },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  listHeader: { gap: spacing.lg, paddingBottom: spacing.lg },
  resultStrip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  separator: { height: spacing.md },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
