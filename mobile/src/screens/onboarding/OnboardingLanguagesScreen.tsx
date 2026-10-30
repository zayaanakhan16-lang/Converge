import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { InlineMessage } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { LANGUAGES, TRANSLATABLE_LANGUAGE_CODES } from '../../constants/taxonomy';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';
import { SelectionStep } from './SelectionStep';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingLanguages'>;

export function OnboardingLanguagesScreen({ navigation }: Props) {
  const { draft, toggle } = useOnboarding();
  const untranslatableSelected = draft.languages.filter(
    (code) => !TRANSLATABLE_LANGUAGE_CODES.includes(code),
  );

  return (
    <OnboardingLayout
      step={4}
      totalSteps={7}
      title="Which languages do you speak?"
      subtitle="Converge uses these for matching and for translation. Add the language you are most comfortable writing in first."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('OnboardingGoals')}
      onSkip={() => navigation.navigate('OnboardingGoals')}
    >
      <View style={styles.stack}>
        <SelectionStep
          options={LANGUAGES.map((language) => ({
            id: language.code,
            label: language.label,
            hint: language.nativeLabel,
            group: language.translatable ? 'translation-ready' : 'community-only',
          }))}
          selected={draft.languages}
          onToggle={(id) => toggle('languages', id)}
          groupLabels={{
            'translation-ready': 'Automatic translation available',
            'community-only': 'Community matching only',
          }}
          recommended={1}
          searchPlaceholder="Search languages"
        />

        {untranslatableSelected.length > 0 ? (
          <InlineMessage
            tone="info"
            message={`Automatic translation is not yet wired for ${untranslatableSelected
              .map((code) => LANGUAGES.find((l) => l.code === code)?.label ?? code)
              .join(', ')}. You can still match with members who speak them, and messages you send in a supported language will be translated.`}
          />
        ) : null}

        <Text token="caption" tone="muted">
          Your language list is visible on your profile. It is never used to infer your
          location or nationality.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
});
