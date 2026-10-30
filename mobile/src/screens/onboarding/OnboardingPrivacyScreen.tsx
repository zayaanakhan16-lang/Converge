import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/ui/Text';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { OnboardingLayout, OptionGroup, OptionRow } from './OnboardingLayout';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingPrivacy'>;

/**
 * Privacy step.
 *
 * Defaults are the most protective option, and the screen states exactly what
 * each setting changes rather than describing it in the abstract.
 */
export function OnboardingPrivacyScreen({ navigation }: Props) {
  const { draft, setPrivacy } = useOnboarding();
  const privacy = draft.privacy;

  return (
    <OnboardingLayout
      step={7}
      totalSteps={7}
      title="Who can find you?"
      subtitle="These settings apply immediately and can be changed at any time from your profile."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('OnboardingComplete')}
      nextLabel="Review my profile"
    >
      <View style={styles.stack}>
        <OptionGroup
          title="PROFILE VISIBILITY"
          description="Controls where your profile can appear."
        >
          <OptionRow
            label="Community only"
            hint="Visible to members of communities you join. Recommended."
            selected={privacy.visibility === 'community'}
            onPress={() => setPrivacy({ visibility: 'community' })}
          />
          <OptionRow
            label="Discoverable"
            hint="Visible to everyone on Converge, not only your communities."
            selected={privacy.visibility === 'discoverable'}
            onPress={() => setPrivacy({ visibility: 'discoverable' })}
          />
          <OptionRow
            label="Private"
            hint="Hidden from discovery. You can still browse and join communities."
            selected={privacy.visibility === 'private'}
            onPress={() => setPrivacy({ visibility: 'private' })}
          />
        </OptionGroup>

        <OptionGroup title="CONNECTION AND COMMUNITY">
          <OptionRow
            label="Accept connection requests"
            hint="When off, nobody can send you a request. You can still send them."
            selected={privacy.allowConnectionRequests}
            onPress={() =>
              setPrivacy({ allowConnectionRequests: !privacy.allowConnectionRequests })
            }
            control="switch"
          />
          <OptionRow
            label="Appear in community member lists"
            hint="When off, you can take part in discussions without being listed."
            selected={privacy.showInCommunityLists}
            onPress={() => setPrivacy({ showInCommunityLists: !privacy.showInCommunityLists })}
            control="switch"
          />
          <OptionRow
            label="Use my approximate area for matching"
            hint="Rounds to about five kilometres. Turning this off removes distance from matching."
            selected={privacy.shareApproximateLocation}
            onPress={() =>
              setPrivacy({ shareApproximateLocation: !privacy.shareApproximateLocation })
            }
            control="switch"
          />
        </OptionGroup>

        <Text token="caption" tone="muted">
          Your email address, phone number and exact coordinates are never shown to other
          members, whatever you choose here. Private messaging always requires a connection you
          have accepted.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxl },
});
