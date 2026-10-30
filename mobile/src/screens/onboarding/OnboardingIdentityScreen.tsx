import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '../../components/ui/Chip';
import { InlineMessage } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import { useTheme } from '../../context/ThemeContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_HEADLINE_LENGTH,
  firstErrorFor,
  validateDisplayName,
  validateFields,
} from '../../utils/validation';
import { OnboardingLayout } from './OnboardingLayout';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingIdentity'>;

/**
 * Identity step.
 *
 * The photo is picked locally and only uploaded at the end of onboarding, so a
 * user who abandons the flow leaves nothing behind in storage.
 */
export function OnboardingIdentityScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { draft, update } = useOnboarding();
  const [errors, setErrors] = useState<ReturnType<typeof validateFields>['errors']>([]);
  const [pickerMessage, setPickerMessage] = useState<string | null>(null);

  const choosePhoto = async () => {
    setPickerMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerMessage('Photo access was declined. You can add a photo later in your profile.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    update({
      avatarLocalUri: asset.uri,
      avatarMimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const next = () => {
    const validation = validateFields([['displayName', validateDisplayName(draft.displayName)]]);
    setErrors(validation.errors);
    if (!validation.valid) return;
    navigation.navigate('OnboardingInterests');
  };

  return (
    <OnboardingLayout
      step={1}
      totalSteps={7}
      title="How should people know you?"
      subtitle="Your display name is the only name other members see. Your email address is never shown."
      onBack={() => navigation.goBack()}
      onNext={next}
      onSkip={() => navigation.navigate('OnboardingInterests')}
    >
      <View style={styles.photoRow}>
        <Avatar name={draft.displayName || 'New member'} uri={draft.avatarLocalUri} size={78} />
        <View style={styles.photoActions}>
          <Pressable
            onPress={choosePhoto}
            accessibilityRole="button"
            accessibilityLabel="Choose a profile photo"
            style={[
              styles.photoButton,
              { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
            ]}
          >
            <Camera size={16} color={theme.colors.textPrimary} strokeWidth={2} />
            <Text token="caption">
              {draft.avatarLocalUri ? 'Change photo' : 'Add a photo'}
            </Text>
          </Pressable>
          {draft.avatarLocalUri ? (
            <Pressable
              onPress={() => update({ avatarLocalUri: null, avatarMimeType: null })}
              accessibilityRole="button"
              accessibilityLabel="Remove profile photo"
              hitSlop={8}
            >
              <Text token="caption" tone="muted">
                Remove
              </Text>
            </Pressable>
          ) : (
            <Text token="caption" tone="muted">
              Optional. Initials are used if you skip this.
            </Text>
          )}
        </View>
      </View>

      {pickerMessage ? <InlineMessage tone="info" message={pickerMessage} /> : null}

      <TextField
        label="Display name"
        value={draft.displayName}
        onChangeText={(value) => update({ displayName: value })}
        error={firstErrorFor(errors, 'displayName')}
        placeholder="Your name or a name you go by"
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        required
        autoComplete="name"
        returnKeyType="next"
      />

      <TextField
        label="Headline"
        value={draft.headline}
        onChangeText={(value) => update({ headline: value })}
        hint="One line that gives people something to open with."
        placeholder="e.g. Second-year computing student, learning Spanish"
        maxLength={MAX_HEADLINE_LENGTH}
        returnKeyType="next"
      />

      <TextField
        label="Short introduction"
        value={draft.bio}
        onChangeText={(value) => update({ bio: value })}
        hint={`${draft.bio.length}/${MAX_BIO_LENGTH} characters. What are you looking for, and what can you offer?`}
        placeholder="I am looking for people to work on small projects with, and I can help with front-end development."
        multiline
        numberOfLines={5}
        maxLength={MAX_BIO_LENGTH}
        textAlignVertical="top"
        containerStyle={styles.multiline}
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginBottom: spacing.xl },
  photoActions: { flex: 1, gap: spacing.sm, alignItems: 'flex-start' },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  multiline: { marginBottom: spacing.sm },
});
