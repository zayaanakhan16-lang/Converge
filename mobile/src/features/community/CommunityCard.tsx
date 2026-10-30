import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import type { Community, CommunityEvent } from '../../types/domain';
import { formatCountdown, formatDateRange } from '../../utils/format';
import { Chip } from '../../components/ui/Chip';
import { Text } from '../../components/ui/Text';

export interface CommunityCardProps {
  community: Community;
  membershipState?: 'none' | 'requested' | 'invited' | 'member';
  onPress: () => void;
}

export function CommunityCard({ community, membershipState = 'none', onPress }: CommunityCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={`${community.name}. ${community.purpose}`}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onPress}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.crest,
              { backgroundColor: community.coverColour, borderColor: theme.colors.border },
            ]}
          >
            <Text token="title3" color="#FFFFFF">
              {community.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text token="title3" numberOfLines={1}>
              {community.name}
            </Text>
            <Text token="caption" tone="secondary" numberOfLines={2}>
              {community.purpose}
            </Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Users size={13} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted">
              {community.memberCount} members
            </Text>
          </View>
          {community.location?.areaLabel ? (
            <View style={styles.metaItem}>
              <MapPin size={13} color={theme.colors.textMuted} strokeWidth={2} />
              <Text token="caption" tone="muted">
                {community.location.areaLabel}
              </Text>
            </View>
          ) : null}
          {community.membershipRequiresApproval ? (
            <View style={styles.metaItem}>
              <Text token="caption" tone="muted">
                Approval required
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chipRow}>
          {membershipState === 'member' ? (
            <Chip label="Joined" readOnly tone="accent" />
          ) : membershipState === 'requested' ? (
            <Chip label="Request sent" readOnly />
          ) : null}
          {community.interestIds.slice(0, 2).map((id) => (
            <Chip key={id} label={id.replace(/-/g, ' ')} readOnly />
          ))}
        </View>
      </View>
    </View>
  );
}

export interface EventCardProps {
  event: CommunityEvent;
  communityName?: string;
  attending?: boolean;
  onPress: () => void;
}

export function EventCard({ event, communityName, attending = false, onPress }: EventCardProps) {
  const { theme } = useTheme();
  const remaining =
    event.capacity === null ? null : Math.max(0, event.capacity - event.attendeeCount);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={`${event.title}. ${formatDateRange(event.startsAt, event.endsAt)} at ${event.venueName}`}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onPress}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text token="title3" numberOfLines={2}>
              {event.title}
            </Text>
            {communityName ? (
              <Text token="caption" tone="accent">
                {communityName}
              </Text>
            ) : null}
          </View>
          {attending ? <Chip label="Going" readOnly tone="accent" /> : null}
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <CalendarDays size={13} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted">
              {formatDateRange(event.startsAt, event.endsAt)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MapPin size={13} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted" numberOfLines={1}>
              {event.venueName}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Users size={13} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted">
              {event.attendeeCount} going
              {remaining !== null ? ` · ${remaining} places left` : ''}
            </Text>
          </View>
        </View>

        <Text token="caption" color={theme.colors.accent}>
          {formatCountdown(event.startsAt)}
        </Text>
      </View>
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
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  crest: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  headerText: { flex: 1, gap: spacing.xxs },
  meta: { gap: spacing.xs },
  metaItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
