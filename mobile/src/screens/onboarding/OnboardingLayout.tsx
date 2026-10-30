import { ChevronLeft } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';

export interface OnboardingLayoutProps {
  step: number;
  totalSteps: number;
  title: string;
  /** Explains why the step exists and what happens to the answer. */
  subtitle: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  /** Optional secondary action rendered under the primary button. */
  onSkip?: () => void;
  skipLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}

/**
 * Shared frame for onboarding steps.
 *
 * Progress is shown as discrete segments rather than a percentage so the user
 * can see how many decisions remain, and every step offers a way forward.
 */
export function OnboardingLayout({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  onSkip,
  skipLabel = 'Skip for now',
  nextDisabled = false,
  busy = false,
}: OnboardingLayoutProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
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
        ) : (
          <View style={styles.back} />
        )}
        <View
          style={styles.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step} of ${totalSteps}`}
          accessibilityValue={{ min: 1, max: totalSteps, now: step }}
        >
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    index < step ? theme.colors.accent : theme.colors.border,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <View style={styles.heading}>
              <Text token="title1">{title}</Text>
              <Text token="body" tone="secondary" style={styles.subtitle}>
                {subtitle}
              </Text>
            </View>
            {children}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.footerColumn}>
            <Button
              label={nextLabel}
              onPress={onNext}
              size="lg"
              fullWidth
              disabled={nextDisabled}
              loading={busy}
            />
            {onSkip ? (
              <Button label={skipLabel} variant="ghost" onPress={onSkip} fullWidth />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Grouped, selectable options used by the interests, skills and goals steps. */
export function OptionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <Text token="label" tone="secondary">
          {title}
        </Text>
        {description ? (
          <Text token="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.groupBody,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function OptionRow({
  label,
  hint,
  selected,
  onPress,
  /** Renders a switch-style control instead of a checkbox. */
  control = 'checkbox',
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  control?: 'checkbox' | 'switch';
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={control === 'switch' ? 'switch' : 'checkbox'}
      accessibilityState={
        control === 'switch' ? { checked: selected } : { checked: selected }
      }
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={styles.optionText}>
        <Text token="body">{label}</Text>
        {hint ? (
          <Text token="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          control === 'switch' ? styles.switch : styles.checkbox,
          {
            backgroundColor: selected ? theme.colors.primary : 'transparent',
            borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
          },
        ]}
      >
        {selected ? (
          <View
            style={[
              control === 'switch' ? styles.switchKnobOn : styles.checkMark,
              { backgroundColor: control === 'switch' ? '#FFFFFF' : 'transparent' },
            ]}
          >
            {control === 'checkbox' ? (
              <Text token="caption" color="#FFFFFF">
                ✓
              </Text>
            ) : null}
          </View>
        ) : control === 'switch' ? (
          <View style={[styles.switchKnob, { backgroundColor: theme.colors.borderStrong }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  back: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 3, borderRadius: radius.pill },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: spacing.lg },
  heading: { gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.sm },
  subtitle: { maxWidth: 480 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  footerColumn: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  group: { marginBottom: spacing.xl, gap: spacing.sm },
  groupHeading: { gap: spacing.xxs },
  groupBody: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  optionText: { flex: 1, gap: spacing.xxs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { alignItems: 'center', justifyContent: 'center' },
  switch: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    padding: 2,
    justifyContent: 'center',
  },
  switchKnob: { width: 18, height: 18, borderRadius: 9, marginLeft: 0 },
  switchKnobOn: { width: 18, height: 18, borderRadius: 9, alignSelf: 'flex-end' },
});
