import { ChevronLeft } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConvergeMark } from '../../components/brand/ConvergeMark';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../context/ThemeContext';
import { MIN_TOUCH_TARGET, spacing } from '../../theme';

export interface AuthLayoutProps {
  title: string;
  /** One sentence explaining what this step does. */
  subtitle: string;
  children: React.ReactNode;
  onBack?: () => void;
  /** Rendered under the form, e.g. a link to the other auth screen. */
  footer?: React.ReactNode;
}

/**
 * Shared frame for the authentication screens.
 *
 * The mark sits at the top so every entry point is visually anchored to the
 * brand, and the form column is constrained so it stays readable on tablets.
 */
export function AuthLayout({ title, subtitle, children, onBack, footer }: AuthLayoutProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={12}
                style={styles.back}
              >
                <ChevronLeft size={22} color={theme.colors.textPrimary} strokeWidth={2} />
              </Pressable>
            ) : null}

            <View style={styles.brand}>
              <ConvergeMark
                size={40}
                stroke={theme.colors.primary}
                node={theme.colors.accent}
              />
            </View>

            <View style={styles.heading}>
              <Text token="display">{title}</Text>
              <Text token="body" tone="secondary" style={styles.subtitle}>
                {subtitle}
              </Text>
            </View>

            <View style={styles.form}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxxl },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: spacing.xl },
  back: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    // Pulled left so the icon still optically aligns with the text column,
    // which the target would otherwise push inward.
    marginLeft: -spacing.md,
  },
  brand: { marginBottom: spacing.xl },
  heading: { gap: spacing.sm, marginBottom: spacing.xxl },
  subtitle: { maxWidth: 380 },
  form: { gap: spacing.lg },
  footer: { marginTop: spacing.xxl, alignItems: 'center' },
});
