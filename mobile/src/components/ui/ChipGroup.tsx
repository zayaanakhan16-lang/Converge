import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';
import { Chip } from './Chip';
import { Text } from './Text';

export interface ChipGroupProps {
  title: string;
  /** Explains what the choice affects. */
  description?: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  /** Trailing action, e.g. "Clear all". */
  action?: { label: string; onPress: () => void };
}

/**
 * A titled, wrapping set of selectable chips.
 *
 * Used wherever a screen offers a flat multi-select list: preferred activities,
 * languages, goals and the interest editor in profile settings.
 */
export function ChipGroup({
  title,
  description,
  options,
  selected,
  onToggle,
  action,
}: ChipGroupProps) {
  const { theme } = useTheme();
  const selectedSet = new Set(selected);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text token="title3">{title}</Text>
          {description ? (
            <Text token="caption" tone="secondary">
              {description}
            </Text>
          ) : null}
        </View>
        {action ? (
          <Text
            token="caption"
            tone="accent"
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            {action.label}
          </Text>
        ) : null}
      </View>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={selectedSet.has(option.id)}
            onPress={() => onToggle(option.id)}
          />
        ))}
      </View>
      <Text token="caption" color={theme.colors.textMuted}>
        {selected.length === 0 ? 'None selected' : `${selected.length} selected`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
