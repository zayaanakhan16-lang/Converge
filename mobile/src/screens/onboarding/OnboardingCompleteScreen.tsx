import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Circle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Chip } from '../../components/ui/Chip';
import { Button, InlineMessage } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import {
  labelForActivity,
  labelForGoal,
  labelForInterest,
  labelForLanguage,
  labelForSkill,
} from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import { draftCompleteness } from '../../features/onboarding/types';
import type { OnboardingStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingComplete'>;

/**
 * Review and submit step.
 *
 * Missing items are listed rather than blocking submission: the brief requires
 * that optional information can be skipped, and the profile is editable later.
 */
export function OnboardingCompleteScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { draft, reset } = useOnboarding();
  const { updateProfile, uploadAvatar, busy, error } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const completeness = draftCompleteness(draft);

  const submit = async () => {
    setSubmitError(null);
    try {
      // `uploadAvatar` stores the object and records its path on the profile,
      // so the photo is not part of the update payload below.
      if (draft.avatarLocalUri && draft.avatarMimeType) {
        await uploadAvatar(draft.avatarLocalUri, draft.avatarMimeType);
      }
      await updateProfile({
        displayName: draft.displayName.trim(),
        headline: draft.headline.trim() || null,
        bio: draft.bio.trim() || null,
        interests: draft.interests,
        skills: draft.skills,
        learningSkills: draft.learningSkills,
        languages: draft.languages.length > 0 ? draft.languages : ['en'],
        goals: draft.goals,
        preferredActivities: draft.preferredActivities,
        location: draft.locationConsent ? draft.location : null,
        privacy: draft.privacy,
        onboardingCompleted: true,
      });
      reset();
    } catch (caught) {
      setSubmitError(
        caught instanceof Error ? caught.message : 'Could not save your profile. Try again.',
      );
    }
  };

  return (
    <OnboardingLayout
      step={7}
      totalSteps={7}
      title="Here is your profile"
      subtitle="Check it over. Everything here can be changed later, and nothing is shown outside your chosen visibility."
      onBack={() => navigation.goBack()}
      onNext={submit}
      nextLabel="Save and continue"
      busy={busy}
    >
      <View style={styles.stack}>
        {error || submitError ? (
          <InlineMessage tone="error" message={submitError ?? error ?? ''} />
        ) : null}

        <View
          style={[
            styles.summary,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.identity}>
            <Avatar name={draft.displayName || 'New member'} uri={draft.avatarLocalUri} size={56} />
            <View style={styles.identityText}>
              <Text token="title2">{draft.displayName || 'Unnamed member'}</Text>
              <Text token="caption" tone="secondary">
                {draft.headline || 'No headline yet'}
              </Text>
            </View>
          </View>
          {draft.bio ? (
            <Text token="body" tone="secondary">
              {draft.bio}
            </Text>
          ) : (
            <Text token="body" tone="muted">
              No introduction yet. Members with an introduction receive noticeably more replies.
            </Text>
          )}
        </View>

        <CompletenessCard
          filled={completeness.filled}
          total={completeness.total}
          missing={completeness.missing}
        />

        <ReviewSection
          title="Interests"
          ids={draft.interests}
          label={labelForInterest}
          onEdit={() => navigation.navigate('OnboardingInterests')}
        />
        <ReviewSection
          title="Skills offered"
          ids={draft.skills}
          label={labelForSkill}
          onEdit={() => navigation.navigate('OnboardingSkills')}
        />
        <ReviewSection
          title="Skills to develop"
          ids={draft.learningSkills}
          label={labelForSkill}
          onEdit={() => navigation.navigate('OnboardingSkills')}
        />
        <ReviewSection
          title="Languages"
          ids={draft.languages}
          label={labelForLanguage}
          onEdit={() => navigation.navigate('OnboardingLanguages')}
        />
        <ReviewSection
          title="Goals"
          ids={draft.goals}
          label={labelForGoal}
          onEdit={() => navigation.navigate('OnboardingGoals')}
        />
        <ReviewSection
          title="Preferred activities"
          ids={draft.preferredActivities}
          label={labelForActivity}
          onEdit={() => navigation.navigate('OnboardingInterests')}
        />

        <View
          style={[
            styles.summary,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text token="label" tone="secondary">
            PRIVACY
          </Text>
          <Text token="caption" tone="secondary">
            Visibility: {draft.privacy.visibility} · Approximate area:{' '}
            {draft.locationConsent && draft.location ? draft.location.areaLabel ?? 'shared' : 'not shared'}{' '}
            · Connection requests: {draft.privacy.allowConnectionRequests ? 'open' : 'closed'}
          </Text>
          <Button
            label="Change privacy settings"
            variant="ghost"
            onPress={() => navigation.navigate('OnboardingPrivacy')}
            style={styles.ghostButton}
          />
        </View>
      </View>
    </OnboardingLayout>
  );
}

function CompletenessCard({
  filled,
  total,
  missing,
}: {
  filled: number;
  total: number;
  missing: string[];
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.summary,
        { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
      ]}
    >
      <Text token="label" tone="secondary">
        PROFILE STRENGTH {filled}/{total}
      </Text>
      {missing.length === 0 ? (
        <Text token="caption" color={theme.colors.success}>
          Everything that improves your recommendations is filled in.
        </Text>
      ) : (
        <View style={styles.missingList}>
          {missing.map((item) => (
            <View key={item} style={styles.missingRow}>
              <Circle size={6} color={theme.colors.warning} strokeWidth={3} />
              <Text token="caption" tone="secondary">
                {item} is still empty
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text token="caption" tone="muted">
        You can save now and add the rest later.
      </Text>
    </View>
  );
}

function ReviewSection({
  title,
  ids,
  label,
  onEdit,
}: {
  title: string;
  ids: string[];
  label: (id: string) => string;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.summary,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.sectionHeading}>
        <Text token="label" tone="secondary">
          {title.toUpperCase()}
        </Text>
        <Text
          token="caption"
          tone="accent"
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
        >
          Edit
        </Text>
      </View>
      {ids.length === 0 ? (
        <Text token="caption" tone="muted">
          Nothing selected.
        </Text>
      ) : (
        <View style={styles.chipWrap}>
          {ids.map((id) => (
            <Chip key={id} label={label(id)} readOnly tone="accent" />
          ))}
        </View>
      )}
      {ids.length > 0 ? (
        <View style={styles.filledRow}>
          <Check size={13} color={theme.colors.success} strokeWidth={3} />
          <Text token="caption" color={theme.colors.success}>
            {ids.length} selected
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  summary: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  identityText: { flex: 1, gap: spacing.xxs },
  missingList: { gap: spacing.xs },
  missingRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filledRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  ghostButton: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
