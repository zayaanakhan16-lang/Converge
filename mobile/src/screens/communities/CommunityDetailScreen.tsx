import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, MessageSquareText, ShieldCheck, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Chip, LoadingState } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { EmptyState } from '../../components/ui/EmptyState';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { labelForInterest, labelForLanguage } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { EventCard } from '../../features/community/CommunityCard';
import {
  useCommunity,
  useCommunityMembers,
  useEvents,
  useMemberships,
  useMutation,
} from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'CommunityDetail'>;

/**
 * Community profile.
 *
 * Membership, upcoming events, member list and the group discussion all live
 * here so a member has one place to participate from.
 */
export function CommunityDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { communityId } = route.params;
  const { user } = useAuth();
  const community = useCommunity(communityId);
  const members = useCommunityMembers(communityId);
  const memberships = useMemberships();
  const events = useEvents({ communityIds: [communityId] });

  const [note, setNote] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);

  const membership = memberships.data.find((item) => item.communityId === communityId);
  const isMember = membership?.state === 'member';

  const join = useMutation(
    useCallback(async () => {
      return repository().requestMembership(communityId, note.trim() || undefined);
    }, [communityId, note]),
  );

  const leave = useMutation(
    useCallback(async () => repository().leaveCommunity(communityId), [communityId]),
  );

  if (community.loading) return <LoadingState label="Loading community" />;
  if (!community.data) {
    return (
      <Screen>
        <EmptyState
          kind="error"
          title="Community unavailable"
          description="This community may have been removed, or it is private and you are not a member."
          action={{ label: 'Go back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const item = community.data;

  const confirmLeave = () => {
    Alert.alert(
      `Leave ${item.name}?`,
      'You will lose access to its discussions and member list. You can request to rejoin later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const result = await leave.run();
            if (result !== null) {
              void memberships.refresh();
              void members.refresh();
            }
          },
        },
      ],
    );
  };

  const submitRequest = async () => {
    const result = await join.run();
    if (result) {
      setRequestOpen(false);
      setNote('');
      void memberships.refresh();
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View
            style={[
              styles.crest,
              { backgroundColor: item.coverColour, borderColor: theme.colors.border },
            ]}
          >
            <Text token="title1" color="#FFFFFF">
              {item.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.heroText}>
            <Text token="title1">{item.name}</Text>
            <Text token="body" tone="secondary">
              {item.purpose}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Users size={13} color={theme.colors.textMuted} strokeWidth={2} />
                <Text token="caption" tone="muted">
                  {item.memberCount} members
                </Text>
              </View>
              {item.location?.areaLabel ? (
                <Text token="caption" tone="muted">
                  {item.location.areaLabel}
                </Text>
              ) : null}
              {item.isPrivate ? (
                <Chip label="Private" readOnly />
              ) : null}
              {item.membershipRequiresApproval ? (
                <Chip label="Approval required" readOnly />
              ) : null}
            </View>
          </View>
        </View>

        {item.description ? (
          <Card>
            <SectionHeader title="About" />
            <Text token="body" tone="secondary">
              {item.description}
            </Text>
          </Card>
        ) : null}

        <Card>
          <SectionHeader title="Membership" />
          {isMember ? (
            <View style={styles.actions}>
              <InlineMessage
                tone="success"
                message={
                  membership?.role === 'organiser' || membership?.role === 'owner'
                    ? `You organise this community.`
                    : 'You are a member of this community.'
                }
              />
              <Button
                label="Open group discussion"
                onPress={() => navigation.navigate('CommunityDiscussion', { communityId })}
                icon={<MessageSquareText size={16} color={theme.colors.onPrimary} strokeWidth={2} />}
                fullWidth
              />
              <Button label="Leave community" variant="secondary" onPress={confirmLeave} loading={leave.busy} fullWidth />
              {leave.error ? <InlineMessage tone="error" message={leave.error} /> : null}
            </View>
          ) : membership?.state === 'requested' ? (
            <View style={styles.actions}>
              <InlineMessage
                tone="info"
                message="Your membership request is pending. An organiser reviews requests for this community."
              />
              <Button label="Withdraw request" variant="secondary" onPress={confirmLeave} loading={leave.busy} fullWidth />
            </View>
          ) : (
            <View style={styles.actions}>
              {requestOpen ? (
                <>
                  <TextField
                    label="Note for the organiser"
                    value={note}
                    onChangeText={setNote}
                    hint="Optional. Say why you want to join, in one or two sentences."
                    multiline
                    numberOfLines={3}
                    maxLength={240}
                  />
                  <Button label="Send request" onPress={submitRequest} loading={join.busy} fullWidth />
                  <Button label="Cancel" variant="ghost" onPress={() => setRequestOpen(false)} fullWidth />
                </>
              ) : (
                <Button
                  label={item.membershipRequiresApproval ? 'Request to join' : 'Join community'}
                  onPress={() => (item.membershipRequiresApproval ? setRequestOpen(true) : submitRequest())}
                  loading={join.busy}
                  fullWidth
                />
              )}
              {join.error ? <InlineMessage tone="error" message={join.error} /> : null}
            </View>
          )}
        </Card>

        <Card>
          <SectionHeader title="Focus" subtitle="What this community is organised around." />
          <View style={styles.chipRow}>
            {item.interestIds.map((id) => (
              <Chip key={id} label={labelForInterest(id)} readOnly tone="accent" />
            ))}
            {item.languageCodes.map((code) => (
              <Chip key={code} label={labelForLanguage(code)} readOnly />
            ))}
          </View>
        </Card>

        <View>
          <SectionHeader
            title="Upcoming events"
            subtitle="Events are held in public venues so members can meet safely."
            action={
              isMember
                ? {
                    label: 'Create event',
                    onPress: () => navigation.navigate('CreateEvent', { communityId }),
                  }
                : undefined
            }
          />
          {events.loading ? (
            <LoadingState label="Loading events" />
          ) : events.data.length === 0 ? (
            <Card>
              <Text token="body" tone="muted">
                No upcoming events.{' '}
                {isMember ? 'Create one to get members together.' : 'Join to help organise one.'}
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {events.data.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  communityName={item.name}
                  onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader
            title="Members"
            subtitle="Members who have chosen to be listed. Visibility is controlled per member."
          />
          {members.loading ? (
            <LoadingState label="Loading members" />
          ) : members.data.length === 0 ? (
            <Card>
              <Text token="body" tone="muted">
                No members are currently listed in this community.
              </Text>
            </Card>
          ) : (
            <Card>
              <View style={styles.memberList}>
                {members.data.slice(0, 12).map((member) => (
                  <View key={member.id} style={styles.member}>
                    <Avatar name={member.displayName} uri={member.avatarUrl} size={38} />
                    <View style={styles.memberText}>
                      <Text token="bodyStrong" numberOfLines={1}>
                        {member.displayName}
                      </Text>
                      <Text token="caption" tone="muted" numberOfLines={1}>
                        {member.headline ?? 'No headline'}
                      </Text>
                    </View>
                    {member.id !== user?.id ? (
                      <Button
                        label="View"
                        variant="ghost"
                        onPress={() =>
                          navigation.getParent()?.navigate('Discover', {
                            screen: 'ProfileDetail',
                            params: { userId: member.id },
                          })
                        }
                      />
                    ) : (
                      <Chip label="You" readOnly />
                    )}
                  </View>
                ))}
              </View>
              {members.data.length > 12 ? (
                <Text token="caption" tone="muted" style={styles.more}>
                  and {members.data.length - 12} more members
                </Text>
              ) : null}
            </Card>
          )}
        </View>

        <View
          style={[
            styles.safety,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <ShieldCheck size={16} color={theme.colors.accent} strokeWidth={2} />
          <Text token="caption" tone="secondary" style={styles.safetyText}>
            Community activities must take place in public venues. Converge does not share member
            contact details, and organisers cannot see your exact location.
          </Text>
        </View>

        {item.joinCode ? (
          <View style={styles.shareRow}>
            <CalendarDays size={14} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted">
              This community has a join code for in-person sign-up: {item.joinCode}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  hero: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  crest: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  heroText: { flex: 1, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.md },
  list: { gap: spacing.md },
  memberList: { gap: spacing.md },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberText: { flex: 1, gap: spacing.xxs },
  more: { marginTop: spacing.md },
  safety: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'flex-start',
  },
  safetyText: { flex: 1 },
  shareRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
