import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InlineMessage, Button } from '../../components/ui/Button';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { INTERESTS, LANGUAGES } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMutation } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';
import {
  firstErrorFor,
  validateCommunityName,
  validateFields,
} from '../../utils/validation';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'CreateCommunity'>;

/**
 * Create a community.
 *
 * Communities are the unit of context in Converge, so creation asks for a
 * purpose as well as a name: the purpose is what matching quotes back.
 */
export function CreateCommunityScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [description, setDescription] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateFields>['errors']>([]);

  const create = useMutation(
    useCallback(
      async () => {
        if (!user) throw new Error('You need to be signed in.');
        return repository().createCommunity(user.id, {
          name: name.trim(),
          purpose: purpose.trim(),
          description: description.trim(),
          interestIds: interests,
          languageCodes: languages,
          membershipRequiresApproval: requiresApproval,
          isPrivate,
          joinCode: joinCode.trim() || null,
        });
      },
      [description, interests, isPrivate, joinCode, languages, name, purpose, requiresApproval, user],
    ),
  );

  const submit = async () => {
    const validation = validateFields([
      ['name', validateCommunityName(name)],
      ['purpose', purpose.trim().length < 8 ? 'Describe the purpose in at least 8 characters.' : null],
      ['interests', interests.length === 0 ? 'Choose at least one interest.' : null],
      ['languages', languages.length === 0 ? 'Choose at least one language.' : null],
    ]);
    setErrors(validation.errors);
    if (!validation.valid) return;
    const created = await create.run();
    if (created) {
      navigation.replace('CommunityDetail', { communityId: created.id });
    }
  };

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Create a community</Text>
          <Text token="body" tone="secondary">
            You become its first organiser. Communities are what give Converge&apos;s matching its
            context, so the purpose matters more than the name.
          </Text>
        </View>

        {create.error ? <InlineMessage tone="error" message={create.error} /> : null}

        <TextField
          label="Community name"
          value={name}
          onChangeText={setName}
          error={firstErrorFor(errors, 'name')}
          hint="Up to 60 characters. This is what members search for."
          placeholder="e.g. Northside Data Collective"
          maxLength={60}
          required
        />

        <TextField
          label="Purpose"
          value={purpose}
          onChangeText={setPurpose}
          error={firstErrorFor(errors, 'purpose')}
          hint="One sentence. This is quoted in match explanations."
          placeholder="e.g. Practise data analysis together and share small projects"
          maxLength={120}
          required
        />

        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          hint="Optional. What members do, when they meet and what a new member can expect."
          multiline
          numberOfLines={5}
          maxLength={600}
        />

        <ChipGroup
          title="Interests"
          description="At least one. These feed discovery and matching."
          options={INTERESTS.map((interest) => ({ id: interest.id, label: interest.label }))}
          selected={interests}
          onToggle={(id) => toggle(interests, setInterests, id)}
        />
        {firstErrorFor(errors, 'interests') ? (
          <Text token="caption" tone="danger">
            {firstErrorFor(errors, 'interests')}
          </Text>
        ) : null}

        <ChipGroup
          title="Languages"
          description="Languages this community operates in."
          options={LANGUAGES.map((language) => ({ id: language.code, label: language.label }))}
          selected={languages}
          onToggle={(id) => toggle(languages, setLanguages, id)}
        />
        {firstErrorFor(errors, 'languages') ? (
          <Text token="caption" tone="danger">
            {firstErrorFor(errors, 'languages')}
          </Text>
        ) : null}

        <Card>
          <SectionHeader
            title="Membership rules"
            subtitle="These protect the quality of the group and can be changed later."
          />
          <View style={styles.toggles}>
            <Button
              label={requiresApproval ? 'Approval required ✓' : 'Anyone can join'}
              variant="secondary"
              onPress={() => setRequiresApproval((value) => !value)}
              icon={<Users size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
              fullWidth
            />
            <Button
              label={isPrivate ? 'Private: members only ✓' : 'Public: listed in search'}
              variant="secondary"
              onPress={() => setIsPrivate((value) => !value)}
              icon={<Lock size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
              fullWidth
            />
          </View>
          <Text token="caption" tone="muted" style={styles.ruleNote}>
            {isPrivate
              ? 'A private community is hidden from search. Members join with a code you share.'
              : 'A public community appears in search and can be browsed by any signed-in member.'}
          </Text>
        </Card>

        <TextField
          label="Join code"
          value={joinCode}
          onChangeText={setJoinCode}
          hint="Optional. Letters, numbers and hyphens. Use this for QR codes at in-person sign-up."
          placeholder="e.g. DATA-2026"
          autoCapitalize="characters"
          maxLength={24}
        />

        <View
          style={[
            styles.note,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <Text token="caption" tone="secondary">
            As an organiser you can create events, post to the group discussion and review
            membership requests. You cannot see members&apos; exact locations, email addresses or phone
            numbers — Converge does not store or expose them to organisers.
          </Text>
        </View>

        <Button label="Create community" onPress={submit} loading={create.busy} size="lg" fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  toggles: { gap: spacing.sm },
  ruleNote: { marginTop: spacing.md },
  note: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
