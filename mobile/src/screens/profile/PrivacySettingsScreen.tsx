import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';
import { OptionGroup, OptionRow } from '../onboarding/OnboardingLayout';
import type { Visibility } from '../../types/domain';

type Props = NativeStackScreenProps<ProfileStackParamList, 'PrivacySettings'>;

/**
 * Privacy settings.
 *
 * Every setting here states its effect on who can see or contact the member.
 * The screen also lists what Converge never does, because that is what people
 * actually want to know before trusting a platform of this kind.
 */
export function PrivacySettingsScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuth();
  const [privacy, setPrivacy] = useState(profile?.privacy);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!privacy) {
    return (
      <Screen>
        <Text token="body" tone="muted">
          Loading your privacy settings…
        </Text>
      </Screen>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ privacy });
      setNotice('Privacy settings saved. They apply immediately.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save those settings.');
    } finally {
      setBusy(false);
    }
  };

  const patch = (next: Partial<typeof privacy>) => setPrivacy({ ...privacy, ...next });

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Privacy and discovery</Text>
          <Text token="body" tone="secondary">
            Discovery is opt-in. You can take part in communities without appearing in any list.
          </Text>
        </View>

        {error ? <InlineMessage tone="error" message={error} /> : null}
        {notice ? <InlineMessage tone="success" message={notice} /> : null}

        <OptionGroup
          title="WHO CAN SEE YOUR PROFILE"
          description="Choose one. This controls whether you appear in AuraMatch results."
        >
          {(
            [
              {
                id: 'community' as Visibility,
                label: 'Community only',
                hint: 'Visible to members of communities you join, and in AuraMatch for those members.',
              },
              {
                id: 'discoverable' as Visibility,
                label: 'Discoverable',
                hint: 'Visible to every signed-in member through discovery and matching.',
              },
              {
                id: 'private' as Visibility,
                label: 'Private',
                hint: 'Hidden from discovery and matching. You can still browse, join and post.',
              },
            ]
          ).map((option) => (
            <OptionRow
              key={option.id}
              label={option.label}
              hint={option.hint}
              selected={privacy.visibility === option.id}
              onPress={() => patch({ visibility: option.id })}
            />
          ))}
        </OptionGroup>

        <OptionGroup title="CONTACT AND COMMUNITY">
          <OptionRow
            label="Accept connection requests"
            hint="When off, nobody can start a conversation with you. You can still send requests."
            selected={privacy.allowConnectionRequests}
            onPress={() => patch({ allowConnectionRequests: !privacy.allowConnectionRequests })}
            control="switch"
          />
          <OptionRow
            label="Show me in community member lists"
            hint="When off, you can read and post in discussions without being listed as a member."
            selected={privacy.showInCommunityLists}
            onPress={() => patch({ showInCommunityLists: !privacy.showInCommunityLists })}
            control="switch"
          />
          <OptionRow
            label="Use my approximate area for matching"
            hint="Rounds your position to roughly five kilometres. Distance is one signal among several."
            selected={privacy.shareApproximateLocation}
            onPress={() =>
              patch({ shareApproximateLocation: !privacy.shareApproximateLocation })
            }
            control="switch"
          />
        </OptionGroup>

        <Card>
          <SectionHeader
            title="What Converge never does"
            subtitle="These are architectural guarantees, not preferences."
          />
          <Bullet text="Your exact coordinates are never stored. Location is rounded on your device before it is sent." />
          <Bullet text="There is no background location tracking and no location history." />
          <Bullet text="Your email address and phone number are never shown to other members or to organisers." />
          <Bullet text="Nobody can send you a private message without a connection you accepted." />
          <Bullet text="You are never placed on a public map, and your position is never shown to anyone." />
          <Bullet text="Blocking is immediate, silent and mutual: a blocked member cannot find you again." />
        </Card>

        <Button label="Save privacy settings" onPress={save} loading={busy} size="lg" fullWidth />
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </Screen>
  );
}

function Bullet({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.bullet}>
      <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
      <Text token="caption" tone="secondary" style={styles.bulletText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  bullet: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { flex: 1 },
  note: { borderRadius: radius.md },
});
