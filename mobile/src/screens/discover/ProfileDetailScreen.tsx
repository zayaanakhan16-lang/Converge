import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Flag, Lock, MessageSquareText, ShieldOff, Sparkles, UserPlus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Chip, LoadingState } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { EmptyState } from '../../components/ui/EmptyState';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import {
  labelForActivity,
  labelForGoal,
  labelForInterest,
  labelForLanguage,
  labelForSkill,
} from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MatchReasons } from '../../features/matching/MatchCard';
import { rankMatches } from '../../features/matching/engine';
import { useBlockedUsers, useConnections, useProfile, useProfiles, useMutation } from '../../hooks/useData';
import type { DiscoverStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';
import { REPORT_REASONS, type ReportReason } from '../../types/domain';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'ProfileDetail'>;

/**
 * Member profile.
 *
 * The top of the screen answers "why is this person here?" before showing any
 * profile detail, because the recommendation is the reason the user opened it.
 */
export function ProfileDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { userId } = route.params;
  const { user, profile: viewer, isDemoMode } = useAuth();
  const profileState = useProfile(userId);
  const connections = useConnections();
  const blocked = useBlockedUsers();
  const profiles = useProfiles();

  const [reason, setReason] = useState('');
  const [showReasonField, setShowReasonField] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportDetail, setReportDetail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const sendRequest = useMutation(
    useCallback(
      async (toUserId: string, text: string | null) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().sendConnectionRequest(user.id, toUserId, text);
      },
      [user],
    ),
  );

  const block = useMutation(
    useCallback(
      async (targetId: string) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().blockUser(user.id, targetId);
      },
      [user],
    ),
  );

  const report = useMutation(
    useCallback(
      async (input: { subjectUserId: string; reason: ReportReason; detail?: string }) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().submitReport(user.id, input);
      },
      [user],
    ),
  );

  const openConversation = useMutation(
    useCallback(
      async (otherUserId: string) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().openDirectConversation(user.id, otherUserId);
      },
      [user],
    ),
  );

  const target = profileState.data;

  // Recompute the explanation for this specific pair so the detail view can show
  // every reason, not just the three the card had room for.
  const match = useMemo(() => {
    if (!viewer || !target || !profiles.data.length) return null;
    const context = { viewerCommunities: [], candidateCommunities: new Map(), excludedUserIds: new Set<string>() };
    const ranked = rankMatches(viewer, profiles.data.filter((p) => p.id === target.id), context);
    return ranked[0] ?? null;
  }, [profiles.data, target, viewer]);

  if (profileState.loading) return <LoadingState label="Loading profile" />;
  if (!target) {
    return (
      <Screen>
        <EmptyState
          kind="error"
          title="This profile is not available"
          description="The member may have changed their visibility settings, or the link may be out of date."
          action={{ label: 'Go back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const isSelf = viewer?.id === target.id;
  const outgoing = connections.data.outgoing.find((request) => request.toUserId === target.id);
  const incoming = connections.data.incoming.find((request) => request.fromUserId === target.id);
  const connection = connections.data.connections.find((item) => item.userId === target.id);
  const isBlocked = blocked.data.some((item) => item.userId === target.id);
  const visibilityHidden = target.privacy.visibility === 'private' && !connection;

  const requestConnection = async () => {
    setNotice(null);
    const result = await sendRequest.run(target.id, reason.trim() || null);
    if (result) {
      setShowReasonField(false);
      setReason('');
      setNotice('Request sent. You will be able to message once they accept.');
      void connections.refresh();
    }
  };

  const startConversation = async () => {
    setNotice(null);
    const conversation = await openConversation.run(target.id);
    if (conversation) {
      navigation.navigate('DiscoverHome');
      navigation.getParent()?.navigate('Messages', {
        screen: 'Chat',
        params: { conversationId: conversation.id },
      });
    } else if (openConversation.error) {
      setNotice(openConversation.error);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${target.displayName}?`,
      'They will not be able to see your profile, send requests or message you. Existing connections are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const result = await block.run(target.id);
            if (result !== null) {
              setNotice(`${target.displayName} has been blocked.`);
              void blocked.refresh();
              void connections.refresh();
            }
          },
        },
      ],
    );
  };

  const submitReport = async () => {
    const result = await report.run({
      subjectUserId: target.id,
      reason: reportReason,
      detail: reportDetail,
    });
    if (result) {
      setReportOpen(false);
      setReportDetail('');
      setNotice('Report submitted. Moderators review reports and will act on this one.');
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        {notice ? <InlineMessage tone="success" message={notice} /> : null}

        <View style={styles.identity}>
          <Avatar name={target.displayName} uri={target.avatarUrl} size={72} />
          <View style={styles.identityText}>
            <Text token="title1">{target.displayName}</Text>
            {target.headline ? (
              <Text token="body" tone="secondary">
                {target.headline}
              </Text>
            ) : null}
            {target.location?.areaLabel ? (
              <Text token="caption" tone="muted">
                Approximate area: {target.location.areaLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {visibilityHidden ? (
          <InlineMessage
            tone="info"
            message={`${target.displayName} has chosen community-only visibility. Their details are limited until you share a community or a connection.`}
          />
        ) : null}

        <Card>
          <SectionHeader
            title="Why AuraMatch suggested this"
            subtitle="Each line is a signal from both profiles, not a score."
          />
          {match ? (
            <MatchReasons reasons={match.reasons} />
          ) : (
            <Text token="caption" tone="muted">
              Not enough shared signals to explain a recommendation yet.
            </Text>
          )}
        </Card>

        {target.bio ? (
          <Card>
            <SectionHeader title="Introduction" />
            <Text token="body" tone="secondary">
              {target.bio}
            </Text>
          </Card>
        ) : null}

        {!visibilityHidden ? (
          <>
            <AttributeCard title="Interests" ids={target.interests} label={labelForInterest} />
            <AttributeCard title="Can help with" ids={target.skills} label={labelForSkill} />
            <AttributeCard
              title="Wants to learn"
              ids={target.learningSkills}
              label={labelForSkill}
            />
            <AttributeCard title="Languages" ids={target.languages} label={labelForLanguage} />
            <AttributeCard title="Goals" ids={target.goals} label={labelForGoal} />
            <AttributeCard
              title="Preferred activities"
              ids={target.preferredActivities}
              label={labelForActivity}
            />
          </>
        ) : null}

        {!isSelf ? (
          <Card>
            <SectionHeader
              title="Next step"
              subtitle="Converge explains the match; you decide whether to act on it."
            />

            {isBlocked ? (
              <InlineMessage
                tone="info"
                message="You have blocked this account. Unblock them from Settings to interact again."
              />
            ) : connection ? (
              <View style={styles.actions}>
                <Button
                  label="Message"
                  onPress={startConversation}
                  loading={openConversation.busy}
                  icon={<MessageSquareText size={16} color={theme.colors.onPrimary} strokeWidth={2} />}
                  fullWidth
                />
                <Text token="caption" tone="muted">
                  You are connected. Messaging is available because you both accepted.
                </Text>
              </View>
            ) : outgoing ? (
              <InlineMessage
                tone="info"
                message="Your connection request is pending. You will be able to message once it is accepted."
              />
            ) : incoming ? (
              <View style={styles.actions}>
                <Button
                  label="Respond to their request"
                  onPress={() =>
                    navigation.getParent()?.navigate('Connections', {
                      screen: 'ConnectionsHome',
                      params: { tab: 'incoming' },
                    })
                  }
                  fullWidth
                />
                <Text token="caption" tone="muted">
                  They asked first. Accepting opens messaging for both of you.
                </Text>
              </View>
            ) : target.privacy.allowConnectionRequests ? (
              <View style={styles.actions}>
                {showReasonField ? (
                  <>
                    <TextField
                      label="Reason for connecting"
                      value={reason}
                      onChangeText={setReason}
                      hint="Optional, but a specific reason gets a reply far more often."
                      placeholder={`e.g. You mentioned you are learning React and I can help with that.`}
                      multiline
                      numberOfLines={3}
                      maxLength={240}
                    />
                    <Button
                      label="Send request"
                      onPress={requestConnection}
                      loading={sendRequest.busy}
                      fullWidth
                    />
                    <Button
                      label="Cancel"
                      variant="ghost"
                      onPress={() => setShowReasonField(false)}
                      fullWidth
                    />
                  </>
                ) : (
                  <>
                    <Button
                      label="Send connection request"
                      onPress={() => setShowReasonField(true)}
                      icon={<UserPlus size={16} color={theme.colors.onPrimary} strokeWidth={2} />}
                      fullWidth
                    />
                    <Button
                      label="Practise what to say first"
                      variant="secondary"
                      onPress={() => navigation.navigate('Coach')}
                      icon={<Sparkles size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
                      fullWidth
                    />
                  </>
                )}
                {sendRequest.error ? (
                  <InlineMessage tone="error" message={sendRequest.error} />
                ) : null}
              </View>
            ) : (
              <InlineMessage
                tone="info"
                message={`${target.displayName} has turned off connection requests. You can still share a community with them.`}
              />
            )}
          </Card>
        ) : null}

        {!isSelf ? (
          <Card>
            <SectionHeader
              title="Safety"
              subtitle="Reports are reviewed by moderators. Blocking is immediate and private."
            />
            <View style={styles.safetyActions}>
              {!isBlocked ? (
                <Button
                  label="Block"
                  variant="secondary"
                  onPress={confirmBlock}
                  loading={block.busy}
                  icon={<ShieldOff size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
                />
              ) : null}
              <Button
                label="Report"
                variant="secondary"
                onPress={() => setReportOpen((value) => !value)}
                icon={<Flag size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
              />
            </View>

            {reportOpen ? (
              <View style={styles.reportForm}>
                <Text token="label" tone="secondary">
                  REASON
                </Text>
                <View style={styles.chipRow}>
                  {REPORT_REASONS.map((item) => (
                    <Chip
                      key={item.id}
                      label={item.label}
                      selected={reportReason === item.id}
                      onPress={() => setReportReason(item.id)}
                    />
                  ))}
                </View>
                <TextField
                  label="What happened"
                  value={reportDetail}
                  onChangeText={setReportDetail}
                  hint="Optional. Concrete details help moderators act faster."
                  multiline
                  numberOfLines={4}
                  maxLength={600}
                />
                <Button
                  label="Submit report"
                  onPress={submitReport}
                  loading={report.busy}
                  fullWidth
                />
                {report.error ? <InlineMessage tone="error" message={report.error} /> : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        {isDemoMode ? (
          <Text token="caption" tone="muted">
            Demo mode: requests, blocks and reports are stored locally for this session and are
            not sent anywhere.
          </Text>
        ) : null}

        {visibilityHidden ? (
          <View style={styles.lockedNote}>
            <Lock size={14} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted">
              Some sections are hidden by this member&apos;s visibility settings.
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function AttributeCard({
  title,
  ids,
  label,
}: {
  title: string;
  ids: string[];
  label: (id: string) => string;
}) {
  const { theme } = useTheme();
  if (ids.length === 0) return null;
  return (
    <Card>
      <View style={styles.attributeHeading}>
        <Text token="title3">{title}</Text>
        <Text token="caption" tone="muted">
          {ids.length}
        </Text>
      </View>
      <View style={[styles.chipRow, styles.attributeChips]}>
        {ids.map((id) => (
          <Chip key={id} label={label(id)} readOnly tone="accent" />
        ))}
      </View>
      <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  identity: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  identityText: { flex: 1, gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  attributeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  attributeChips: { marginBottom: spacing.sm },
  rule: { height: StyleSheet.hairlineWidth * 2, marginTop: spacing.sm },
  actions: { gap: spacing.md },
  safetyActions: { flexDirection: 'row', gap: spacing.md },
  reportForm: { gap: spacing.md, marginTop: spacing.lg },
  lockedNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  radiusNote: { borderRadius: radius.md },
});
