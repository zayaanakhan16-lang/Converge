import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { OptionGroup, OptionRow } from '../onboarding/OnboardingLayout';
import { DEFAULT_NOTIFICATIONS, type NotificationSettings } from '../../types/domain';

type Props = NativeStackScreenProps<ProfileStackParamList, 'NotificationSettings'>;

/**
 * Notification preferences.
 *
 * Each switch maps to a real notification kind the backend can emit, so turning
 * one off has a defined effect rather than being decorative.
 */
export function NotificationSettingsScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(
    profile?.notifications ?? { ...DEFAULT_NOTIFICATIONS },
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ notifications: settings });
      setNotice('Notification preferences saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your preferences.');
    } finally {
      setBusy(false);
    }
  };

  const patch = (next: Partial<NotificationSettings>) => setSettings({ ...settings, ...next });

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Notifications</Text>
          <Text token="body" tone="secondary">
            Choose what Converge tells you about. Safety-related notices about your own account are
            always delivered.
          </Text>
        </View>

        {error ? <InlineMessage tone="error" message={error} /> : null}
        {notice ? <InlineMessage tone="success" message={notice} /> : null}

        <OptionGroup title="ACTIVITY">
          <OptionRow
            label="Connection requests"
            hint="When someone asks to connect with you, including any reason they gave."
            selected={settings.connectionRequests}
            onPress={() => patch({ connectionRequests: !settings.connectionRequests })}
            control="switch"
          />
          <OptionRow
            label="Messages"
            hint="When a connected member sends you a message."
            selected={settings.messages}
            onPress={() => patch({ messages: !settings.messages })}
            control="switch"
          />
          <OptionRow
            label="Community activity"
            hint="Membership decisions, new members and posts in communities you belong to."
            selected={settings.communityActivity}
            onPress={() => patch({ communityActivity: !settings.communityActivity })}
            control="switch"
          />
          <OptionRow
            label="Event reminders"
            hint="A reminder before events you have confirmed you are attending."
            selected={settings.eventReminders}
            onPress={() => patch({ eventReminders: !settings.eventReminders })}
            control="switch"
          />
          <OptionRow
            label="Product updates"
            hint="Occasional notes about new Converge features. Never marketing from third parties."
            selected={settings.productUpdates}
            onPress={() => patch({ productUpdates: !settings.productUpdates })}
            control="switch"
          />
        </OptionGroup>

        <Card>
          <SectionHeader title="Quiet by design" />
          <Text token="caption" tone="secondary">
            Converge does not send notifications about profile views, follower counts or engagement
            streaks. There is no such mechanic in the product.
          </Text>
        </Card>

        <Button label="Save preferences" onPress={save} loading={busy} size="lg" fullWidth />
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
});
