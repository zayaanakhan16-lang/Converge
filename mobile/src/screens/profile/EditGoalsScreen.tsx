import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ACTIVITIES, GOALS } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { ProfileListEditor } from './ProfileListEditor';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditGoals'>;

/**
 * Goal editor.
 *
 * Goals carry the most weight in AuraMatch, and they are also what the coach
 * uses to pick practice scenarios, so the editor explains both effects.
 */
export function EditGoalsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  return (
    <ProfileListEditor
      title="Goals"
      description="Two people wanting the same outcome is the strongest reason Converge has for introducing them. Your goals also shape which practice scenarios the coach suggests."
      options={GOALS.map((goal) => ({ id: goal.id, label: goal.label }))}
      initial={profile?.goals ?? []}
      minimum={1}
      searchPlaceholder="Search goals"
      field="goals"
      onSaved={() => navigation.goBack()}
    />
  );
}

/** Preferred activities live alongside goals because both describe intent. */
export function EditActivitiesSection() {
  const { profile } = useAuth();
  return (
    <ProfileListEditor
      title="Preferred activities"
      description="Activities decide which events and groups Converge suggests."
      options={ACTIVITIES.map((activity) => ({ id: activity.id, label: activity.label }))}
      initial={profile?.preferredActivities ?? []}
      minimum={0}
      field="preferredActivities"
    />
  );
}
