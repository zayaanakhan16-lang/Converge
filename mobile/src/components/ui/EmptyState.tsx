import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';
import { EmptyArt, type EmptyArtKind } from '../illustration';
import { FadeIn } from '../motion';
import { Button } from './Button';
import { Text } from './Text';

export type EmptyKind = 'no-results' | 'no-data' | 'error' | 'offline';

export interface EmptyStateProps {
  kind?: EmptyKind;
  title: string;
  description: string;
  /** A single, clearly labelled next action. Omitted when none makes sense. */
  action?: { label: string; onPress: () => void };
  /**
   * Which illustration to draw. Defaults to one chosen from `kind`, but a
   * screen can name a more specific scene (people, communities, messages) so
   * the empty state reflects the section it appears in.
   */
  art?: EmptyArtKind;
  /** A second action, for when there is a genuine alternative path. */
  secondaryAction?: { label: string; onPress: () => void };
}

const ART_FOR_KIND: Record<EmptyKind, EmptyArtKind> = {
  'no-results': 'search',
  'no-data': 'people',
  error: 'error',
  offline: 'error',
};

/**
 * Empty, error and offline states.
 *
 * Every list in Converge renders one of these rather than a blank screen. Each
 * one explains, in plain language, what the absence means and what to do next,
 * and each carries a slow animated illustration so an empty screen still looks
 * designed rather than broken.
 */
export function EmptyState({
  kind = 'no-data',
  title,
  description,
  action,
  art,
  secondaryAction,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const artKind = art ?? ART_FOR_KIND[kind];

  return (
    <FadeIn style={styles.container}>
      <View style={styles.art}>
        <EmptyArt kind={artKind} />
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
      {secondaryAction ? (
        <Button
          label={secondaryAction.label}
          variant="ghost"
          onPress={secondaryAction.onPress}
        />
      ) : null}
    </FadeIn>
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
  art: { marginBottom: spacing.md },
  description: { maxWidth: 320 },
  action: { marginTop: spacing.lg },
});
