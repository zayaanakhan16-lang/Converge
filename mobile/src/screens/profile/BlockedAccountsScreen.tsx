import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShieldOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, LoadingState } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { EmptyState } from '../../components/ui/EmptyState';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useBlockedUsers, useMutation, useProfiles } from '../../hooks/useData';
import type { ProfileStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { spacing } from '../../theme';
import { formatRelative } from '../../utils/format';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BlockedAccounts'>;

/**
 * Blocked accounts.
 *
 * Blocking hides the member in both directions. Unblocking is deliberately a
 * separate, explicit action, and the screen explains that it does not restore
 * any previous connection.
 */
export function BlockedAccountsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const blocked = useBlockedUsers();
  const profiles = useProfiles();
  const [notice, setNotice] = useState<string | null>(null);

  const unblock = useMutation(
    useCallback(
      async (userId: string) => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().unblockUser(user.id, userId);
      },
      [user],
    ),
  );

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Blocked accounts</Text>
          <Text token="body" tone="secondary">
            Blocked members cannot see your profile, send you requests or message you. They are not
            told that they were blocked.
          </Text>
        </View>

        {notice ? <InlineMessage tone="success" message={notice} /> : null}
        {unblock.error ? <InlineMessage tone="error" message={unblock.error} /> : null}

        {blocked.loading ? (
          <LoadingState label="Loading blocked accounts" />
        ) : blocked.data.length === 0 ? (
          <EmptyState
            kind="no-data"
            title="You have not blocked anyone"
            description="You can block a member from their profile or from a conversation. Blocking is immediate and private."
            action={{ label: 'Back to profile', onPress: () => navigation.goBack() }}
          />
        ) : (
          <Card>
            <SectionHeader
              title={`${blocked.data.length} blocked`}
              subtitle="Unblocking does not restore a connection; you would need to connect again."
            />
            {blocked.data.map((entry) => {
              const profile = profiles.data.find((item) => item.id === entry.userId);
              const name = profile?.displayName ?? 'Blocked member';
              return (
                <View key={entry.userId} style={styles.row}>
                  <Avatar name={name} uri={profile?.avatarUrl} size={40} />
                  <View style={styles.rowText}>
                    <Text token="bodyStrong" numberOfLines={1}>
                      {name}
                    </Text>
                    <Text token="caption" tone="muted">
                      Blocked {formatRelative(entry.blockedAt)}
                    </Text>
                  </View>
                  <Button
                    label="Unblock"
                    variant="secondary"
                    onPress={() =>
                      Alert.alert(
                        `Unblock ${name}?`,
                        'They will be able to see your profile and send you requests again. Any previous connection stays removed.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Unblock',
                            onPress: async () => {
                              const result = await unblock.run(entry.userId);
                              if (result !== null) {
                                setNotice(`${name} has been unblocked.`);
                                void blocked.refresh();
                              }
                            },
                          },
                        ],
                      )
                    }
                  />
                </View>
              );
            })}
          </Card>
        )}

        <Card>
          <SectionHeader title="If someone is harassing you" />
          <View style={styles.guidance}>
            <ShieldOff size={16} color="#0F7C8C" strokeWidth={2} />
            <Text token="caption" tone="secondary" style={styles.guidanceText}>
              Block first, then report from their profile or from the message itself. Reports reach
              moderators with the message content attached, and you can keep using Converge while a
              report is reviewed.
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowText: { flex: 1, gap: spacing.xxs },
  guidance: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  guidanceText: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
});
