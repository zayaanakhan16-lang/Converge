import {
  DEFAULT_PRIVACY,
  type ApproximateLocation,
  type PrivacySettings,
} from '../../types/domain';

/** Profile fields collected during onboarding, held in memory until submit. */
export interface OnboardingDraft {
  displayName: string;
  headline: string;
  bio: string;
  avatarLocalUri: string | null;
  avatarMimeType: string | null;
  interests: string[];
  skills: string[];
  learningSkills: string[];
  languages: string[];
  goals: string[];
  preferredActivities: string[];
  location: ApproximateLocation | null;
  locationConsent: boolean;
  privacy: PrivacySettings;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  displayName: '',
  headline: '',
  bio: '',
  avatarLocalUri: null,
  avatarMimeType: null,
  interests: [],
  skills: [],
  learningSkills: [],
  languages: [],
  goals: [],
  preferredActivities: [],
  location: null,
  locationConsent: false,
  privacy: { ...DEFAULT_PRIVACY },
};

/** Steps in order. Used for the progress indicator and back navigation. */
export const ONBOARDING_STEPS = [
  'OnboardingIntro',
  'OnboardingIdentity',
  'OnboardingInterests',
  'OnboardingSkills',
  'OnboardingLanguages',
  'OnboardingGoals',
  'OnboardingLocation',
  'OnboardingPrivacy',
  'OnboardingComplete',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The first and last steps are framing screens, not data-entry steps. */
export const DATA_STEPS: OnboardingStep[] = ONBOARDING_STEPS.filter(
  (step) => step !== 'OnboardingIntro' && step !== 'OnboardingComplete',
);

export function stepIndex(step: OnboardingStep): number {
  const index = DATA_STEPS.indexOf(step);
  return index < 0 ? 0 : index;
}

/**
 * A profile is useful once it has a name, some interests and a language. This
 * is the bar the completion step reports on; nothing blocks submission.
 */
export function draftCompleteness(draft: OnboardingDraft): {
  filled: number;
  total: number;
  ready: boolean;
  missing: string[];
} {
  const checks: Array<[string, boolean]> = [
    ['Display name', draft.displayName.trim().length >= 2],
    ['A short introduction', draft.bio.trim().length > 0 || draft.headline.trim().length > 0],
    ['At least three interests', draft.interests.length >= 3],
    ['At least one language', draft.languages.length >= 1],
    ['At least one goal', draft.goals.length >= 1],
  ];
  const filled = checks.filter(([, done]) => done).length;
  return {
    filled,
    total: checks.length,
    ready: filled === checks.length,
    missing: checks.filter(([, done]) => !done).map(([label]) => label),
  };
}
