import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LANGUAGES } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { ProfileListEditor } from './ProfileListEditor';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditLanguages'>;

/** Language editor. The first language listed is used as the translation source. */
export function EditLanguagesScreen({ navigation }: Props) {
  const { profile } = useAuth();
  return (
    <ProfileListEditor
      title="Languages"
      description="Languages are used for matching and for translation. Converge treats the first one you select as the language you write in."
      options={LANGUAGES.map((language) => ({
        id: language.code,
        label: language.label,
        hint: language.nativeLabel,
        group: language.translatable ? 'translation-ready' : 'community-only',
      }))}
      initial={profile?.languages ?? []}
      minimum={1}
      groupLabels={{
        'translation-ready': 'Automatic translation available',
        'community-only': 'Community matching only',
      }}
      searchPlaceholder="Search languages"
      field="languages"
      onSaved={() => navigation.goBack()}
    />
  );
}
