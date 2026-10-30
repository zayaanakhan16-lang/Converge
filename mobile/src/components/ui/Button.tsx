import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AlertCircle, Check, Info } from 'lucide-react-native';

import { useTheme } from '../../context/ThemeContext';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label. Size is fixed to keep optical alignment. */
  icon?: React.ReactNode;
  /** Fills the available width. */
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { theme } = useTheme();
  const isInactive = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; text: string; border?: string }> = {
    primary: { background: theme.colors.primary, text: theme.colors.onPrimary },
    secondary: { background: theme.colors.surface, text: theme.colors.textPrimary, border: theme.colors.borderStrong },
    ghost: { background: 'transparent', text: theme.colors.accent },
    danger: { background: theme.colors.error, text: '#FFFFFF' },
  };
  const colours = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: colours.background,
          borderColor: colours.border ?? 'transparent',
          borderWidth: colours.border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: isInactive ? 0.5 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed && !isInactive ? 0.985 : 1 }],
        },
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={colours.text} />
        ) : (
          icon ?? null
        )}
        <Text token="button" color={colours.text} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export interface InlineMessageProps {
  tone: 'error' | 'success' | 'info';
  message: string;
}

/** Inline feedback used for form errors and confirmations. */
export function InlineMessage({ tone, message }: InlineMessageProps) {
  const { theme } = useTheme();
  const config = {
    error: { colour: theme.colors.error, background: theme.colors.surface, Icon: AlertCircle },
    success: { colour: theme.colors.success, background: theme.colors.surface, Icon: Check },
    info: { colour: theme.colors.info, background: theme.colors.surface, Icon: Info },
  }[tone];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.inline,
        { backgroundColor: config.background, borderColor: theme.colors.border },
      ]}
    >
      <config.Icon size={16} color={config.colour} strokeWidth={2} />
      <Text token="caption" color={config.colour} style={styles.inlineText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl, minHeight: 54 },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  inlineText: { flex: 1 },
});
