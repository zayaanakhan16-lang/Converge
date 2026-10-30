import {
  Activity,
  Building2,
  Compass,
  GraduationCap,
  Languages,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { MatchReason, MatchResult } from '../../types/domain';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import { Avatar, Chip } from '../../components/ui/Chip';
import { Text } from '../../components/ui/Text';

const REASON_ICONS: Record<MatchReason['kind'], typeof Sparkles> = {
  'shared-interest': Compass,
  'complementary-skill': GraduationCap,
  'shared-goal': Sparkles,
  'language-compatibility': Languages,
  'shared-activity': Activity,
  'shared-community': Users,
  proximity: Building2,
};

export interface MatchReasonsProps {
  reasons: MatchReason[];
  /** Limits the list so cards stay scannable; the detail screen shows all. */
  limit?: number;
}

/**
 * The explanation list that makes AuraMatch auditable.
 *
 * Each reason names the specific signal that produced it, so a recommendation
 * can be judged rather than trusted. No numeric score is ever shown.
 */
export function MatchReasons({ reasons, limit }: MatchReasonsProps) {
  const { theme } = useTheme();
  const shown = limit ? reasons.slice(0, limit) : reasons;
  const hidden = limit ? reasons.length - shown.length : 0;

  if (shown.length === 0) {
    return (
      <Text token="caption" tone="muted">
        No shared signals found yet. Add more interests to improve recommendations.
      </Text>
    );
  }

  return (
    <View style={styles.reasons}>
      {shown.map((reason, index) => {
        const Icon = REASON_ICONS[reason.kind];
        return (
          <View key={`${reason.kind}-${index}`} style={styles.reasonRow}>
            <Icon size={14} color={theme.colors.accent} strokeWidth={2.1} />
            <Text token="caption" tone="secondary" style={styles.reasonText}>
              {reason.detail}
            </Text>
          </View>
        );
      })}
      {hidden > 0 ? (
        <Text token="caption" tone="muted">
          and {hidden} more {hidden === 1 ? 'reason' : 'reasons'}
        </Text>
      ) : null}
    </View>
  );
}

export interface MatchCardProps {
  result: MatchResult;
  onPress: () => void;
  /** Rendered under the reasons, e.g. a connect action. */
  footer?: React.ReactNode;
}

export function MatchCard({ result, onPress, footer }: MatchCardProps) {
  const { theme } = useTheme();
  const { profile } = result;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={`${profile.displayName}. ${result.reasons[0]?.detail ?? 'Recommended member'}`}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onPress}
        style={styles.header}
      >
        <Avatar
          name={profile.displayName}
          uri={profile.avatarUrl}
          size={48}
          showAvailability={profile.privacy.allowConnectionRequests}
          availabilityLabel="Open to connection requests"
        />
        <View style={styles.headerText}>
          <Text token="title3" numberOfLines={1}>
            {profile.displayName}
          </Text>
          <Text token="caption" tone="secondary" numberOfLines={2}>
            {profile.headline ?? 'No headline yet'}
          </Text>
        </View>
      </View>

      <MatchReasons reasons={result.reasons} limit={3} />

      {result.sharedInterests.length > 0 ? (
        <View style={styles.chipRow}>
          {result.sharedInterests.slice(0, 3).map((id) => (
            <Chip key={id} label={id.replace(/-/g, ' ')} readOnly tone="accent" />
          ))}
        </View>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headerText: { flex: 1, gap: spacing.xxs },
  reasons: { gap: spacing.sm },
  reasonRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  reasonText: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { marginTop: spacing.xs },
});
