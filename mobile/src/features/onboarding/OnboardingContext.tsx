import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_PRIVACY, type PrivacySettings } from '../../types/domain';
import { EMPTY_DRAFT, type OnboardingDraft } from './types';

interface OnboardingContextValue {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  toggle: (key: ToggleKey, value: string) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
  reset: () => void;
}

type ToggleKey =
  | 'interests'
  | 'skills'
  | 'learningSkills'
  | 'languages'
  | 'goals'
  | 'preferredActivities';

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/**
 * Holds the in-progress profile while the user moves through onboarding.
 *
 * Kept in memory only: nothing is written to the backend until the final step,
 * so a half-finished profile never reaches other members.
 */
export function OnboardingProvider({
  children,
  initialName = '',
}: {
  children: ReactNode;
  initialName?: string;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>({
    ...EMPTY_DRAFT,
    displayName: initialName,
  });

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const toggle = useCallback((key: ToggleKey, value: string) => {
    setDraft((current) => {
      const list = current[key];
      const next = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
      return { ...current, [key]: next };
    });
  }, []);

  const setPrivacy = useCallback((patch: Partial<PrivacySettings>) => {
    setDraft((current) => ({ ...current, privacy: { ...current.privacy, ...patch } }));
  }, []);

  const reset = useCallback(
    () => setDraft({ ...EMPTY_DRAFT, privacy: { ...DEFAULT_PRIVACY } }),
    [],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({ draft, update, toggle, setPrivacy, reset }),
    [draft, update, toggle, setPrivacy, reset],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return context;
}
