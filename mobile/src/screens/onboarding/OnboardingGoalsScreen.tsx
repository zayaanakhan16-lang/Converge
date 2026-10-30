import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/ui/Text';
import { GOALS } from '../../constants/taxonomy';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';
import { SelectionStep } from './SelectionStep';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingGoals'>;

export function OnboardingGoalsScreen({ navigation }: Props) {
  const { draft, toggle } = useOnboarding();

  return (
    <OnboardingLayout
      step={5}
      totalSteps={7}
      title="What are you hoping to get from Converge?"
      subtitle="Goals carry the most weight in AuraMatch, because two people wanting the same thing is the strongest reason to introduce them."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('OnboardingLocation')}
      onSkip={() => navigation.navigate('OnboardingLocation')}
    >
      <View style={styles.stack}>
        <SelectionStep
          options={GOALS.map((goal) => ({ id: goal.id, label: goal.label }))}
          selected={draft.goals}
          onToggle={(id) => toggle('goals', id)}
          recommended={1}
          searchPlaceholder="Search goals"
        />

        <Text token="caption" tone="muted">
          You can change these at any time. Goals are only visible to members who can
          already see your profile.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
});
