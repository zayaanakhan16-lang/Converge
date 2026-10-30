import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { ACTIVITIES, GOALS, INTERESTS, LANGUAGES } from '../../constants/taxonomy';
import { useTheme } from '../../context/ThemeContext';
import {
  EMPTY_FILTERS,
  type DiscoverFilters,
} from '../../features/matching/engine';
import type { DiscoverStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Filters'>;

const DISTANCES = [2, 5, 10, 25];

/**
 * Discover filters.
 *
 * Filters narrow the ranked list rather than replacing the ranking, so the
 * screen says so: relaxing a filter widens the results without changing order.
 */
export function FiltersScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);

  const toggleIn = (key: keyof DiscoverFilters, value: string) => {
    setFilters((current) => {
      const list = current[key] as string[];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Refine recommendations</Text>
          <Text token="body" tone="secondary">
            Filters reduce the list after ranking. AuraMatch keeps explaining each remaining
            result the same way.
          </Text>
        </View>

        <SectionHeader title="Availability" />
        <View style={styles.row}>
          <Chip
            label="Open to conversations"
            selected={filters.openToConversationsOnly}
            onPress={() =>
              setFilters((current) => ({
                ...current,
                openToConversationsOnly: !current.openToConversationsOnly,
              }))
            }
          />
          <Chip
            label="In my communities"
            selected={filters.sharedCommunitiesOnly}
            onPress={() =>
              setFilters((current) => ({
                ...current,
                sharedCommunitiesOnly: !current.sharedCommunitiesOnly,
              }))
            }
          />
        </View>

        <SectionHeader
          title="Interests"
          subtitle="Show only members who share at least one of these."
        />
        <View style={styles.row}>
          {INTERESTS.slice(0, 18).map((interest) => (
            <Chip
              key={interest.id}
              label={interest.label}
              selected={filters.interestIds.includes(interest.id)}
              onPress={() => toggleIn('interestIds', interest.id)}
            />
          ))}
        </View>

        <SectionHeader title="Languages" subtitle="Members who speak at least one of these." />
        <View style={styles.row}>
          {LANGUAGES.map((language) => (
            <Chip
              key={language.code}
              label={language.label}
              selected={filters.languageCodes.includes(language.code)}
              onPress={() => toggleIn('languageCodes', language.code)}
            />
          ))}
        </View>

        <SectionHeader title="Goals" subtitle="Members looking for the same outcome." />
        <View style={styles.row}>
          {GOALS.map((goal) => (
            <Chip
              key={goal.id}
              label={goal.label}
              selected={filters.goalIds.includes(goal.id)}
              onPress={() => toggleIn('goalIds', goal.id)}
            />
          ))}
        </View>

        <SectionHeader title="Activities" subtitle="Members open to the same activities." />
        <View style={styles.row}>
          {ACTIVITIES.map((activity) => (
            <Chip
              key={activity.id}
              label={activity.label}
              selected={filters.activityIds.includes(activity.id)}
              onPress={() => toggleIn('activityIds', activity.id)}
            />
          ))}
        </View>

        <SectionHeader
          title="Distance"
          subtitle="Only applies when both members have chosen to share an approximate area."
        />
        <View style={styles.row}>
          {DISTANCES.map((distance) => (
            <Chip
              key={distance}
              label={`Within ${distance} km`}
              selected={filters.maxDistanceKm === distance}
              onPress={() =>
                setFilters((current) => ({
                  ...current,
                  maxDistanceKm: current.maxDistanceKm === distance ? null : distance,
                }))
              }
            />
          ))}
        </View>

        <View
          style={[
            styles.note,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <Text token="caption" tone="secondary">
            Distance filtering only returns members who have enabled approximate area sharing.
            Nobody&apos;s exact position is ever available to Converge.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Clear all filters"
            variant="secondary"
            onPress={() => setFilters(EMPTY_FILTERS)}
            fullWidth
          />
          <Button
            label="Apply filters"
            onPress={() => navigation.navigate('DiscoverHome', { filters })}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md },
  heading: { gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginTop: spacing.md,
  },
  actions: { gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xxl },
});
