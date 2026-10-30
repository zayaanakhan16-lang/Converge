import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/ui/Chip';
import { SearchField } from '../../components/ui/TextField';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../context/ThemeContext';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../theme';

export interface SelectionOption {
  id: string;
  label: string;
  /** Optional grouping key, e.g. an interest category or skill group. */
  group?: string;
  hint?: string;
}

export interface SelectionStepProps {
  options: SelectionOption[];
  selected: string[];
  onToggle: (id: string) => void;
  /** Rendered above the search field, e.g. a selected-count summary. */
  header?: React.ReactNode;
  /** Minimum selections before the caller treats the step as complete. */
  recommended?: number;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** Shown when the list is long enough to need grouping headers. */
  groupLabels?: Record<string, string>;
  /** Adds a "select all in group" affordance per group. */
  allowGroupSelect?: boolean;
  onSelectGroup?: (ids: string[]) => void;
}

/**
 * Reusable multi-select step.
 *
 * Options are grouped, searchable and rendered as chips so the same component
 * serves interests, skills, languages, goals and activities without each screen
 * reimplementing selection state.
 */
export function SelectionStep({
  options,
  selected,
  onToggle,
  header,
  recommended,
  emptyMessage = 'No options match that search.',
  searchPlaceholder = 'Search',
  groupLabels,
  allowGroupSelect = false,
  onSelectGroup,
}: SelectionStepProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(needle) ||
            (option.hint?.toLowerCase().includes(needle) ?? false),
        )
      : options;
    const map = new Map<string, SelectionOption[]>();
    for (const option of filtered) {
      const key = option.group ?? 'all';
      const list = map.get(key) ?? [];
      list.push(option);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [options, search]);

  return (
    <View style={styles.container}>
      {header}

      <View
        style={[
          styles.summary,
          { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
        ]}
      >
        <Text token="caption" tone="secondary">
          {selected.length === 0
            ? recommended
              ? `Choose at least ${recommended} to get useful recommendations.`
              : 'Nothing selected yet.'
            : `${selected.length} selected${
                recommended && selected.length < recommended
                  ? ` · ${recommended - selected.length} more recommended`
                  : ''
              }`}
        </Text>
      </View>

      {options.length > 10 ? (
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={searchPlaceholder}
          accessibilityLabel={searchPlaceholder}
        />
      ) : null}

      {grouped.length === 0 ? (
        <Text token="body" tone="muted" style={styles.empty}>
          {emptyMessage}
        </Text>
      ) : (
        grouped.map(([group, items]) => (
          <View key={group} style={styles.group}>
            {groupLabels?.[group] || group !== 'all' ? (
              <View style={styles.groupHeader}>
                <Text token="label" tone="secondary">
                  {groupLabels?.[group] ?? group}
                </Text>
                {allowGroupSelect && onSelectGroup ? (
                  // A control, not a label: it needs a real target, so it is a
                  // Pressable rather than text with an onPress.
                  <Pressable
                    onPress={() => onSelectGroup(items.map((item) => item.id))}
                    accessibilityRole="button"
                    accessibilityLabel={`Select all in ${groupLabels?.[group] ?? group}`}
                    style={styles.selectAll}
                  >
                    <Text token="caption" tone="accent">
                      Select all
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.chips}>
              {items.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={selectedSet.has(option.id)}
                  onPress={() => onToggle(option.id)}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  summary: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  group: { gap: spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectAll: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { paddingVertical: spacing.xxl, textAlign: 'center' },
});
