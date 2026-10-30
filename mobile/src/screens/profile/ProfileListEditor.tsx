import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useMutation } from '../../hooks/useData';
import type { ProfileUpdate } from '../../services/types';
import { spacing } from '../../theme';
import { SelectionStep, type SelectionOption } from '../onboarding/SelectionStep';

export interface ProfileListEditorProps {
  title: string;
  description: string;
  /** Options offered for selection. */
  options: SelectionOption[];
  /** Current values from the member's profile. */
  initial: string[];
  /** Minimum selections required before saving. */
  minimum: number;
  groupLabels?: Record<string, string>;
  searchPlaceholder?: string;
  /** Which profile field this editor writes. */
  field: keyof Pick<
    ProfileUpdate,
    'interests' | 'skills' | 'learningSkills' | 'languages' | 'goals' | 'preferredActivities'
  >;
  /** Called after a successful save so the caller can navigate back. */
  onSaved?: () => void;
}

/**
 * Editor for any multi-select profile field.
 *
 * A single implementation backs the interests, skills, languages, goals and
 * activities editors, which keeps validation and save behaviour identical across
 * all of them.
 */
export function ProfileListEditor({
  title,
  description,
  options,
  initial,
  minimum,
  groupLabels,
  searchPlaceholder,
  field,
  onSaved,
}: ProfileListEditorProps) {
  const [selected, setSelected] = useState<string[]>(initial);
  const { updateProfile } = useAuth();

  const save = useMutation(
    useCallback(async (values: string[]) => updateProfile({ [field]: values } as ProfileUpdate), [
      field,
      updateProfile,
    ]),
  );

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = async () => {
    const result = await save.run(selected);
    if (result) onSaved?.();
  };

  const belowMinimum = selected.length < minimum;

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">{title}</Text>
          <Text token="body" tone="secondary">
            {description}
          </Text>
        </View>

        {save.error ? <InlineMessage tone="error" message={save.error} /> : null}

        <SelectionStep
          options={options}
          selected={selected}
          onToggle={toggle}
          recommended={minimum}
          groupLabels={groupLabels}
          searchPlaceholder={searchPlaceholder}
        />

        <Button
          label={belowMinimum ? `Choose at least ${minimum}` : 'Save changes'}
          onPress={submit}
          disabled={belowMinimum}
          loading={save.busy}
          size="lg"
          fullWidth
        />
        <Button label="Cancel" variant="ghost" onPress={() => setSelected(initial)} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
});
