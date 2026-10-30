import { Check } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../theme';
import { initialsFor } from '../../utils/format';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  /** Selected chips are used for multi-select filters and interest pickers. */
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  /** Non-interactive chips are used to display profile attributes. */
  readOnly?: boolean;
  tone?: 'default' | 'accent';
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function Chip({
  label,
  selected = false,
  onPress,
  onRemove,
  readOnly = false,
  tone = 'default',
  disabled = false,
  icon,
}: ChipProps) {
  const { theme } = useTheme();

  const background = selected
    ? tone === 'accent'
      ? theme.colors.accentSoft
      : theme.colors.primary
    : theme.colors.surface;
  const border = selected
    ? tone === 'accent'
      ? theme.colors.accent
      : theme.colors.primary
    : theme.colors.border;
  const colour = selected
    ? tone === 'accent'
      ? theme.colors.accent
      : theme.colors.onPrimary
    : theme.colors.textSecondary;

  const content = (
    <View style={styles.chipContent}>
      {selected && !icon ? (
        <Check size={13} color={colour} strokeWidth={3} />
      ) : (
        icon ?? null
      )}
      <Text token="caption" color={colour} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  const shell: ViewStyleLike = {
    backgroundColor: background,
    borderColor: border,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    opacity: disabled ? 0.45 : 1,
  };

  if (readOnly || (!onPress && !onRemove)) {
    return <View style={shell}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      disabled={disabled}
      accessibilityRole={onRemove ? 'button' : 'checkbox'}
      accessibilityState={onRemove ? undefined : { checked: selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [shell, { opacity: pressed ? 0.75 : shell.opacity }]}
    >
      {content}
    </Pressable>
  );
}

type ViewStyleLike = Parameters<typeof View>[0]['style'];

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  /** Small accent dot indicating the member is open to conversations. */
  showAvailability?: boolean;
  availabilityLabel?: string;
}

export function Avatar({
  name,
  uri,
  size = 44,
  showAvailability = false,
  availabilityLabel,
}: AvatarProps) {
  const { theme } = useTheme();
  const initials = initialsFor(name);

  return (
    <View style={{ width: size, height: size }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={`${name}'s profile photo`}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.accentSoft,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {uri ? (
          <AvatarImage uri={uri} size={size} />
        ) : (
          <Text
            token={size >= 56 ? 'title2' : 'bodyStrong'}
            color={theme.colors.accent}
            accessibilityElementsHidden
          >
            {initials}
          </Text>
        )}
      </View>
      {showAvailability ? (
        <View
          accessibilityLabel={availabilityLabel ?? 'Open to conversations'}
          style={[
            styles.availability,
            {
              backgroundColor: theme.colors.success,
              borderColor: theme.colors.surface,
              width: Math.max(10, size * 0.26),
              height: Math.max(10, size * 0.26),
              borderRadius: size,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

// Loaded lazily: expo-image is a native module and the Chip component is
// rendered by tests that do not mount native code.
function AvatarImage({ uri, size }: { uri: string; size: number }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require('expo-image') as typeof import('expo-image');
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={160}
      accessibilityIgnoresInvertColors
    />
  );
}

export interface BadgeProps {
  count?: number;
  label?: string;
  tone?: 'accent' | 'neutral' | 'danger';
}

export function Badge({ count, label, tone = 'accent' }: BadgeProps) {
  const { theme } = useTheme();
  const text = label ?? (count && count > 99 ? '99+' : String(count ?? ''));
  if (!text) return null;
  const background = {
    accent: theme.colors.accent,
    neutral: theme.colors.surfaceSunken,
    danger: theme.colors.error,
  }[tone];
  const colour = tone === 'neutral' ? theme.colors.textSecondary : '#FFFFFF';
  return (
    <View
      accessibilityLabel={label ?? `${count} unread`}
      style={[styles.badge, { backgroundColor: background }]}
    >
      <Text token="label" color={colour} style={styles.badgeText}>
        {text}
      </Text>
    </View>
  );
}

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.centred} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text token="caption" tone="muted" style={styles.centredText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  availability: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { letterSpacing: 0.2 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxxl },
  centredText: { textAlign: 'center' },
  touchTarget: { minHeight: MIN_TOUCH_TARGET },
});
