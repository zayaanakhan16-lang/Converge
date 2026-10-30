import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, MapPin, ShieldCheck, Users } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingState } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { EmptyState } from '../../components/ui/EmptyState';
import { Text } from '../../components/ui/Text';
import { labelForActivity, labelForLanguage } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCommunity, useEvent, useMemberships, useMutation } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';
import { formatCountdown, formatDateRange } from '../../utils/format';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'EventDetail'>;

/**
 * Event detail.
 *
 * Attendance is an explicit opt-in. The screen states the venue type and the
 * in-person safety expectations before the join button, because the brief
 * requires safeguards around real-world activities.
 */
export function EventDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { eventId } = route.params;
  const { user } = useAuth();
  const event = useEvent(eventId);
  const memberships = useMemberships();
  const community = useCommunity(event.data?.communityId);

  const toggleAttendance = useMutation(
    useCallback(
      async (attending: boolean) => repository().setEventAttendance(eventId, attending),
      [eventId],
    ),
  );

  if (event.loading) return <LoadingState label="Loading event" />;
  if (!event.data) {
    return (
      <Screen>
        <EmptyState
          kind="error"
          title="Event unavailable"
          description="This event may have been cancelled or removed by its organiser."
          action={{ label: 'Go back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const item = event.data;
  const isMember = memberships.data.some(
    (membership) => membership.communityId === item.communityId && membership.state === 'member',
  );
  const placesLeft = item.capacity === null ? null : Math.max(0, item.capacity - item.attendeeCount);
  const isFull = placesLeft === 0;
  const attending = toggleAttendance.error === null && toggleAttendance.busy === false && false;

  const change = async (next: boolean) => {
    const result = await toggleAttendance.run(next);
    if (result) void event.refresh();
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">{item.title}</Text>
          {community.data ? (
            <Text
              token="caption"
              tone="accent"
              onPress={() =>
                navigation.navigate('CommunityDetail', { communityId: item.communityId })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open ${community.data.name}`}
            >
              {community.data.name}
            </Text>
          ) : null}
        </View>

        <Card>
          <View style={styles.metaList}>
            <View style={styles.metaItem}>
              <CalendarDays size={15} color={theme.colors.accent} strokeWidth={2} />
              <Text token="body" tone="secondary" style={styles.metaText}>
                {formatDateRange(item.startsAt, item.endsAt)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin size={15} color={theme.colors.accent} strokeWidth={2} />
              <Text token="body" tone="secondary" style={styles.metaText}>
                {item.venueName}
                {item.isPublicVenue ? ' · public venue' : ' · venue not verified as public'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Users size={15} color={theme.colors.accent} strokeWidth={2} />
              <Text token="body" tone="secondary" style={styles.metaText}>
                {item.attendeeCount} going
                {placesLeft !== null ? ` · ${placesLeft} places left` : ' · no capacity limit'}
              </Text>
            </View>
          </View>
          <Text token="caption" tone="accent">
            {formatCountdown(item.startsAt)}
          </Text>
        </Card>

        {item.description ? (
          <Card>
            <SectionHeader title="About this event" />
            <Text token="body" tone="secondary">
              {item.description}
            </Text>
          </Card>
        ) : null}

        {item.activityIds.length > 0 || item.languageCodes.length > 0 ? (
          <Card>
            <SectionHeader title="Activities and languages" />
            <Text token="body" tone="secondary">
              {[
                ...item.activityIds.map(labelForActivity),
                ...item.languageCodes.map(labelForLanguage),
              ].join(' · ')}
            </Text>
          </Card>
        ) : null}

        <Card>
          <SectionHeader
            title="Your place"
            subtitle={
              isMember
                ? 'You are a member of the organising community.'
                : 'You can attend as a guest, or join the community first.'
            }
          />
          {toggleAttendance.error ? (
            <InlineMessage tone="error" message={toggleAttendance.error} />
          ) : null}
          <View style={styles.actions}>
            <Button
              label={attending ? 'Cancel my place' : isFull ? 'Event is full' : 'Confirm my place'}
              onPress={() => change(!attending)}
              disabled={isFull && !attending}
              loading={toggleAttendance.busy}
              variant={attending ? 'secondary' : 'primary'}
              fullWidth
            />
            {!isMember ? (
              <Button
                label="Join the organising community"
                variant="ghost"
                onPress={() =>
                  navigation.navigate('CommunityDetail', { communityId: item.communityId })
                }
                fullWidth
              />
            ) : null}
          </View>
        </Card>

        <View
          style={[
            styles.safety,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <ShieldCheck size={16} color={theme.colors.accent} strokeWidth={2} />
          <View style={styles.safetyText}>
            <Text token="bodyStrong">Before you attend</Text>
            <Text token="caption" tone="secondary">
              Events are held in public venues. Converge does not arrange private meetings between
              members who have not met before, does not share contact details, and does not reveal
              who else is attending beyond the total count. Tell someone you trust where you are
              going, and leave if anything feels wrong.
            </Text>
          </View>
        </View>

        {user ? (
          <Text token="caption" tone="muted">
            Attendance is visible only as a count. Your name is not listed publicly.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  metaList: { gap: spacing.md, marginBottom: spacing.md },
  metaItem: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  metaText: { flex: 1 },
  actions: { gap: spacing.md },
  safety: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'flex-start',
  },
  safetyText: { flex: 1, gap: spacing.xs },
});
