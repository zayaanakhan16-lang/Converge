import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_HEADLINE_LENGTH,
  firstErrorFor,
  validateDisplayName,
  validateFields,
} from '../../utils/validation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

/** Edits the free-text parts of a profile and the profile photo. */
export function EditProfileScreen({ navigation }: Props) {
  const { profile, updateProfile, uploadAvatar, busy } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [headline, setHeadline] = useState(profile?.headline ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [localPhoto, setLocalPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateFields>['errors']>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choosePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access was declined. You can change this in Android settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setLocalPhoto({
      uri: result.assets[0].uri,
      mimeType: result.assets[0].mimeType ?? 'image/jpeg',
    });
  };

  const save = async () => {
    const validation = validateFields([['displayName', validateDisplayName(displayName)]]);
    setErrors(validation.errors);
    if (!validation.valid) return;
    setError(null);
    setNotice(null);
    try {
      if (localPhoto) {
        await uploadAvatar(localPhoto.uri, localPhoto.mimeType);
        setLocalPhoto(null);
      }
      await updateProfile({
        displayName: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
      });
      setNotice('Profile saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.');
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Edit profile</Text>
          <Text token="body" tone="secondary">
            Your email address is never shown to other members and cannot be changed here.
          </Text>
        </View>

        {error ? <InlineMessage tone="error" message={error} /> : null}
        {notice ? <InlineMessage tone="success" message={notice} /> : null}

        <Card>
          <SectionHeader title="Profile photo" subtitle="Shown to members who can see your profile." />
          <View style={styles.photoRow}>
            <Avatar
              name={displayName || 'Member'}
              uri={localPhoto?.uri ?? profile?.avatarUrl}
              size={70}
            />
            <View style={styles.photoActions}>
              <Button
                label={localPhoto ? 'Choose a different photo' : 'Choose a photo'}
                variant="secondary"
                onPress={choosePhoto}
              />
              {localPhoto ? (
                <Text token="caption" tone="accent">
                  A new photo is ready to upload when you save.
                </Text>
              ) : (
                <Text token="caption" tone="muted">
                  Square images work best. Initials are used if you have no photo.
                </Text>
              )}
            </View>
          </View>
        </Card>

        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          error={firstErrorFor(errors, 'displayName')}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          required
        />

        <TextField
          label="Headline"
          value={headline}
          onChangeText={setHeadline}
          hint="One line, shown under your name everywhere."
          maxLength={MAX_HEADLINE_LENGTH}
          placeholder="e.g. Studying computing, learning Spanish"
        />

        <TextField
          label="Short introduction"
          value={bio}
          onChangeText={setBio}
          hint={`${bio.length}/${MAX_BIO_LENGTH} characters.`}
          multiline
          numberOfLines={5}
          maxLength={MAX_BIO_LENGTH}
        />

        <Button label="Save changes" onPress={save} loading={busy} size="lg" fullWidth />
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  photoRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  photoActions: { flex: 1, gap: spacing.sm, alignItems: 'flex-start' },
});
