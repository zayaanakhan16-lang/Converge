import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { ConvergeLogo, ConvergeMark } from '../../components/brand/ConvergeMark';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../context/ThemeContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { radius, spacing, typography } from '../../theme';
import { tokens } from '../../theme/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Brand'>;

/**
 * Brand reference.
 *
 * The same palette the design system was built from, rendered live so the values
 * on screen are the values in code. Useful for anyone extending the product.
 */
export function BrandScreen({ navigation }: Props) {
  const { theme, themeName } = useTheme();

  const palette = Object.entries(theme.colors) as Array<[string, string]>;

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Brand and design system</Text>
          <Text token="body" tone="secondary">
            Find common ground. Start meaningful conversations. The mark is three paths converging
            on one shared node, drawn as vector geometry in code.
          </Text>
        </View>

        <Card>
          <SectionHeader title="Primary lockup" subtitle="Mark plus wordmark, light background." />
          <View style={styles.lockup}>
            <ConvergeLogo
              size={34}
              colour={theme.colors.primary}
              nodeColour={theme.colors.accent}
            />
          </View>
          <SectionHeader title="Mark only" subtitle="Used for the launcher icon and app chrome." />
          <View style={styles.markRow}>
            <ConvergeMark size={44} stroke={theme.colors.primary} node={theme.colors.accent} />
            <ConvergeMark size={32} stroke={theme.colors.primary} node={theme.colors.primary} />
            <ConvergeMark size={22} stroke={theme.colors.textSecondary} node={theme.colors.textSecondary} />
            <ConvergeMark size={16} stroke={theme.colors.textPrimary} node={theme.colors.textPrimary} />
          </View>
          <Text token="caption" tone="muted">
            Monochrome and small-size variants remain legible because the paths never intersect
            except at the node.
          </Text>
        </Card>

        <Card>
          <SectionHeader
            title={`Active palette (${themeName})`}
            subtitle="Every value below is the token the app is painting with right now."
          />
          <View style={styles.swatches}>
            {palette.map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View
                  style={[
                    styles.swatchChip,
                    { backgroundColor: value, borderColor: theme.colors.border },
                  ]}
                />
                <Text token="caption" tone="secondary">
                  {name}
                </Text>
                <Text token="mono" tone="muted">
                  {value.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <SectionHeader
            title="Typography"
            subtitle="Fraunces for display and screen titles, Manrope for everything else."
          />
          {(
            [
              ['display', 'Find common ground'],
              ['title1', 'Screen title'],
              ['title2', 'Section title'],
              ['title3', 'Card title'],
              ['body', 'Body text carries explanations and descriptions.'],
              ['bodyStrong', 'Emphasised body text'],
              ['caption', 'Supporting detail and metadata'],
              ['label', 'LABEL TEXT'],
              ['button', 'Button label'],
              ['mono', 'EXPO_PUBLIC_SUPABASE_URL'],
            ] as const
          ).map(([token, sample]) => (
            <View key={token} style={styles.typeRow}>
              <Text token={token}>{sample}</Text>
              <Text token="mono" tone="muted">
                {token} · {typography[token].fontSize}px
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <SectionHeader
            title="Contrast"
            subtitle="Pairs verified against WCAG 2.1 AA before any screen was built."
          />
          <View style={styles.contrastList}>
            {tokens.contrast
              .filter((pair) => pair.theme === themeName)
              .map((pair) => (
                <View
                  key={`${pair.foreground}-${pair.background}`}
                  style={styles.contrastRow}
                >
                  <Text token="caption" tone="secondary" style={styles.contrastLabel}>
                    {pair.foreground} on {pair.background} · {pair.level}
                  </Text>
                  <Text token="mono" tone={pair.passes ? 'success' : 'danger'}>
                    {pair.ratio.toFixed(2)}:1 {pair.passes ? 'pass' : 'FAIL'}
                  </Text>
                </View>
              ))}
          </View>
        </Card>

        <Card>
          <SectionHeader title="Spacing and shape" />
          <Text token="caption" tone="secondary">
            Spacing uses a 4-point base scale: {Object.values(spacing).join(', ')}. Radii are
            deliberately restrained — {Object.entries(radius)
              .map(([key, value]) => `${key} ${value}`)
              .join(', ')} — so cards read as surfaces rather than bubbles.
          </Text>
        </Card>

        <Card>
          <SectionHeader title="Where the assets live" />
          <Text token="caption" tone="secondary">
            Source SVGs, PNG exports, the icon set and the written guidelines are in the brand
            folder of the repository, alongside the Python generator that produced them. The mark
            rendered in this app comes from the same coordinate data, so the code and the exported
            assets cannot drift apart.
          </Text>
        </Card>

        <Text
          token="caption"
          tone="accent"
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          Back to profile
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  lockup: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginBottom: spacing.md },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  swatch: { width: 108, gap: spacing.xxs },
  swatchChip: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: spacing.xs,
  },
  typeRow: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: 'transparent',
  },
  contrastList: { gap: spacing.sm },
  contrastRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  contrastLabel: { flex: 1 },
});
