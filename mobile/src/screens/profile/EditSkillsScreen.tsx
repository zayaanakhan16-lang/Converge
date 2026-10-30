import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { SKILLS } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useMutation } from '../../hooks/useData';
import type { ProfileStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { SelectionStep } from '../onboarding/SelectionStep';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditSkills'>;

const GROUP_LABELS: Record<string, string> = {
  technical: 'Technical',
  creative: 'Creative',
  organisational: 'Organising and teaching',
  practical: 'Practical',
};

/**
 * Skills editor.
 *
 * Two lists, because the complementary-skill signal needs both sides: what the
 * member can teach, and what they want to learn.
 */
export function EditSkillsScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuth();
  const [offered, setOffered] = useState<string[]>(profile?.skills ?? []);
  const [learning, setLearning] = useState<string[]>(profile?.learningSkills ?? []);

  const save = useMutation(
    useCallback(
      async () => updateProfile({ skills: offered, learningSkills: learning }),
      [learning, offered, updateProfile],
    ),
  );

  const options = SKILLS.map((skill) => ({ id: skill.id, label: skill.label, group: skill.group }));

  const toggle = (list: string[], setList: (next: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const overlaps = offered.filter((id) => learning.includes(id));

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Skills</Text>
          <Text token="body" tone="secondary">
            Skills you offer and skills you want to learn. AuraMatch pairs the two across
            members, which is what makes a connection useful to both people.
          </Text>
        </View>

        {save.error ? <InlineMessage tone="error" message={save.error} /> : null}
        {overlaps.length > 0 ? (
          <InlineMessage
            tone="info"
            message={`You listed ${overlaps.length} skill${
              overlaps.length === 1 ? '' : 's'
            } as both offered and wanted. That is allowed, but you will not be matched with yourself for it.`}
          />
        ) : null}

        <SectionHeader title="Skills you can offer" subtitle="What you could help someone else with." />
        <SelectionStep
          options={options}
          selected={offered}
          onToggle={(id) => toggle(offered, setOffered, id)}
          groupLabels={GROUP_LABELS}
          searchPlaceholder="Search skills"
        />

        <SectionHeader title="Skills you want to learn" subtitle="What you are looking for in others." />
        <SelectionStep
          options={options}
          selected={learning}
          onToggle={(id) => toggle(learning, setLearning, id)}
          groupLabels={GROUP_LABELS}
          searchPlaceholder="Search skills to learn"
        />

        <Button
          label="Save changes"
          onPress={async () => {
            const result = await save.run();
            if (result) navigation.goBack();
          }}
          loading={save.busy}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
});
