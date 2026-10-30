import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import { Text } from './Text';

export interface ScreenProps {
  children: React.ReactNode;
  /** Adds the standard horizontal gutter. Off for full-bleed content like maps. */
  padded?: boolean;
  /** Renders children inside a ScrollView. */
  scroll?: boolean;
  background?: 'default' | 'surface';
  style?: ViewStyle;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

/** Standard screen frame: safe area, theme background, optional scrolling. */
export function Screen({
  children,
  padded = true,
  scroll = false,
  background = 'default',
  style,
  edges = ['bottom'],
}: ScreenProps) {
  const { theme } = useTheme();
  const backgroundColor =
    background === 'surface' ? theme.colors.surface : theme.colors.background;
  const content = padded ? <View style={styles.padded}>{children}</View> : children;

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor }]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, style]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.fill, style]}>{content}</View>
      )}
    </SafeAreaView>
  );
}

export interface CardProps {
  children: React.ReactNode;
  /** Cards are flat by default; elevation is reserved for floating surfaces. */
  elevated?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

export function Card({
  children,
  elevated = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: CardProps) {
  const { theme } = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
  };

  if (!onPress) {
    return (
      <View style={[base, elevated ? theme.elevation.medium : null, style]}>{children}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        base,
        elevated ? theme.elevation.medium : null,
        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export interface SectionHeaderProps {
  title: string;
  /** Optional supporting line that explains the section's purpose. */
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text token="title3">{title}</Text>
        {subtitle ? (
          <Text token="caption" tone="muted" style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
        >
          <Text token="caption" tone="accent">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider({ inset = false }: { inset?: boolean }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth * 2,
        backgroundColor: theme.colors.border,
        marginLeft: inset ? spacing.lg : 0,
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  padded: { flex: 1, paddingHorizontal: spacing.lg },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeaderText: { flex: 1, gap: spacing.xxs },
  sectionSubtitle: { marginTop: spacing.xxs },
});
