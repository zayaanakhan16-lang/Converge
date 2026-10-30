import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { ChipGroup } from '../../components/ui/ChipGroup';
import { ACTIVITIES, INTERESTS } from '../../constants/taxonomy';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';
import { SelectionStep } from './SelectionStep';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingInterests'>;

const CATEGORY_LABELS: Record<string, string> = {
  technology: 'Technology',
  arts: 'Arts and media',
  academia: 'Study and academia',
  sport: 'Sport',
  outdoors: 'Outdoors',
  community: 'Community',
  craft: 'Craft and making',
  music: 'Music',
};

export function OnboardingInterestsScreen({ navigation }: Props) {
  const { draft, toggle } = useOnboarding();

  return (
    <OnboardingLayout
      step={2}
      totalSteps={7}
      title="What are you interested in?"
      subtitle="Interests drive your recommendations and are what other members search by. Choose as many as you like."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('OnboardingSkills')}
      onSkip={() => navigation.navigate('OnboardingSkills')}
    >
      <View style={styles.stack}>
        <SelectionStep
          options={INTERESTS.map((interest) => ({
            id: interest.id,
            label: interest.label,
            group: interest.category,
          }))}
          selected={draft.interests}
          onToggle={(id) => toggle('interests', id)}
          groupLabels={CATEGORY_LABELS}
          recommended={3}
          searchPlaceholder="Search interests"
          allowGroupSelect
          onSelectGroup={(ids) => {
            for (const id of ids) {
              if (!draft.interests.includes(id)) toggle('interests', id);
            }
          }}
        />

        <ChipGroup
          title="Preferred activities"
          description="Optional. These shape which events and groups Converge suggests."
          options={ACTIVITIES.map((activity) => ({ id: activity.id, label: activity.label }))}
          selected={draft.preferredActivities}
          onToggle={(id) => toggle('preferredActivities', id)}
          action={
            draft.preferredActivities.length > 0
              ? {
                  label: 'Clear',
                  onPress: () => {
                    for (const id of draft.preferredActivities) toggle('preferredActivities', id);
                  },
                }
              : undefined
          }
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxxl },
});
