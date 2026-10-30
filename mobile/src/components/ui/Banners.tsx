import { Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import { Text } from './Text';

export interface DemoDataBannerProps {
  /** Explains what is and is not connected. Never a generic disclaimer. */
  message: string;
  label?: string;
}

/**
 * Marks screens whose data comes from the local demo dataset rather than a
 * configured backend, so demo output can never be mistaken for live results.
 */
export function DemoDataBanner({ message, label = 'Demo data' }: DemoDataBannerProps) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.container,
        { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
      ]}
    >
      <Info size={15} color={theme.colors.accent} strokeWidth={2.2} />
      <View style={styles.text}>
        <Text token="label" color={theme.colors.accent}>
          {label}
        </Text>
        <Text token="caption" tone="secondary" style={styles.message}>
          {message}
        </Text>
      </View>
    </View>
  );
}

export interface FeatureUnavailableProps {
  title: string;
  reason: string;
  /** Exact configuration step the operator needs to take. */
  remedy?: string;
}

/** Shown in place of AI features when the backend is not configured. */
export function FeatureUnavailable({ title, reason, remedy }: FeatureUnavailableProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
      ]}
    >
      <Info size={15} color={theme.colors.textMuted} strokeWidth={2.2} />
      <View style={styles.text}>
        <Text token="label" tone="secondary">
          {title}
        </Text>
        <Text token="caption" tone="muted" style={styles.message}>
          {reason}
        </Text>
        {remedy ? (
          <Text token="mono" tone="muted" style={styles.message}>
            {remedy}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'flex-start',
  },
  text: { flex: 1, gap: spacing.xxs },
  message: { marginTop: spacing.xxs },
});
