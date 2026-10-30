import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/ui/Text';
import { SKILLS } from '../../constants/taxonomy';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { OnboardingLayout, OptionGroup, OptionRow } from './OnboardingLayout';
import { SelectionStep } from './SelectionStep';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingSkills'>;

const GROUP_LABELS: Record<string, string> = {
  technical: 'Technical',
  creative: 'Creative',
  organisational: 'Organising and teaching',
  practical: 'Practical',
};

export function OnboardingSkillsScreen({ navigation }: Props) {
  const { draft, toggle } = useOnboarding();

  const complementary =
    draft.learningSkills.length > 0
      ? SKILLS.filter(
          (skill) =>
            draft.learningSkills.includes(skill.id) && !draft.skills.includes(skill.id),
        ).slice(0, 4)
      : [];

  return (
    <OnboardingLayout
      step={3}
      totalSteps={7}
      title="What can you offer, and what do you want to learn?"
      subtitle="This is what makes AuraMatch useful: it pairs what you know with what someone else is trying to learn."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('OnboardingLanguages')}
      onSkip={() => navigation.navigate('OnboardingLanguages')}
    >
      <View style={styles.stack}>
        <SelectionStep
          options={SKILLS.map((skill) => ({ id: skill.id, label: skill.label, group: skill.group }))}
          selected={draft.skills}
          onToggle={(id) => toggle('skills', id)}
          groupLabels={GROUP_LABELS}
          searchPlaceholder="Search skills"
          emptyMessage="No skills match that search."
        />

        <SelectionStep
          options={SKILLS.map((skill) => ({ id: skill.id, label: skill.label, group: skill.group }))}
          selected={draft.learningSkills}
          onToggle={(id) => toggle('learningSkills', id)}
          groupLabels={GROUP_LABELS}
          searchPlaceholder="Search skills to learn"
          emptyMessage="No skills match that search."
          header={
            <View style={styles.header}>
              <Text token="title3">Skills you want to develop</Text>
              <Text token="caption" tone="secondary">
                Converge looks for members who offer these, so you are matched with someone
                who can actually help.
              </Text>
            </View>
          }
        />

        {complementary.length > 0 ? (
          <OptionGroup
            title="WHAT THIS MEANS"
            description="You will be matched with members who can teach these."
          >
            {complementary.map((skill) => (
              <OptionRow
                key={skill.id}
                label={skill.label}
                hint={`Looking for someone who offers ${skill.label.toLowerCase()}`}
                selected
                onPress={() => undefined}
              />
            ))}
          </OptionGroup>
        ) : null}

      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxxl },
  header: { gap: spacing.xxs },
});
