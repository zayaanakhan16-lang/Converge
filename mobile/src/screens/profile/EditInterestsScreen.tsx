import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { INTERESTS } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { ProfileListEditor } from './ProfileListEditor';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditInterests'>;

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

/**
 * Interest editor.
 *
 * Three interests is the threshold at which AuraMatch can produce more than one
 * explanation, so the editor enforces it.
 */
export function EditInterestsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  return (
    <ProfileListEditor
      title="Interests"
      description="Interests are the strongest shared signal in AuraMatch and the main thing other members search by."
      options={INTERESTS.map((interest) => ({
        id: interest.id,
        label: interest.label,
        group: interest.category,
      }))}
      initial={profile?.interests ?? []}
      minimum={3}
      groupLabels={CATEGORY_LABELS}
      searchPlaceholder="Search interests"
      field="interests"
      onSaved={() => navigation.goBack()}
    />
  );
}
