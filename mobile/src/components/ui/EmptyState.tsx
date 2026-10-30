import { AlertTriangle, Inbox, RefreshCw, SearchX, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';
import { Button } from './Button';
import { Text } from './Text';

export type EmptyKind = 'no-results' | 'no-data' | 'error' | 'offline';

export interface EmptyStateProps {
  kind?: EmptyKind;
  title: string;
  description: string;
  /** A single, clearly labelled next action. Omitted when none makes sense. */
  action?: { label: string; onPress: () => void };
}

const ICONS: Record<EmptyKind, typeof Inbox> = {
  'no-results': SearchX,
  'no-data': Inbox,
  error: AlertTriangle,
  offline: WifiOff,
};

/**
 * Empty, error and offline states.
 *
 * Every list in Converge renders one of these rather than a blank screen, and
 * each explains what to do next in plain language.
 */
export function EmptyState({ kind = 'no-data', title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();
  const Icon = ICONS[kind];
  const iconColour =
    kind === 'error' ? theme.colors.error : kind === 'offline' ? theme.colors.warning : theme.colors.textMuted;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconWell,
          { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
        ]}
      >
        <Icon size={26} color={iconColour} strokeWidth={1.8} />
      </View>
      <Text token="title3" align="center">
        {title}
      </Text>
      <Text token="body" tone="secondary" align="center" style={styles.description}>
        {description}
      </Text>
      {action ? (
        <Button
          label={action.label}
          variant="secondary"
          onPress={action.onPress}
          icon={<RefreshCw size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconWell: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: spacing.sm,
  },
  description: { maxWidth: 320 },
  action: { marginTop: spacing.lg },
});
