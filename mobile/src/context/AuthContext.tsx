import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { config, demoModeReason } from '../constants/config';
import { repository, RepositoryError } from '../services';
import { startSupabaseAutoRefresh } from '../services/supabase/client';
import type { AuthResult, ProfileUpdate } from '../services/types';
import type { Profile, SessionUser } from '../types/domain';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  profile: Profile | null;
  /** Set when the last auth action failed, for inline form display. */
  error: string | null;
  /** True while a sign-in, sign-up or profile write is in flight. */
  busy: boolean;
  isDemoMode: boolean;
  demoReason: string | null;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string, displayName: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  updateProfile(update: ProfileUpdate): Promise<Profile>;
  /**
   * Upload a new profile photo, replacing any existing one.
   *
   * Resolves to a signed URL ready for display. The object itself lives in a
   * private bucket; the URL expires, so it is refreshed by `refreshAvatar`.
   */
  uploadAvatar(localUri: string, mimeType: string): Promise<string>;
  /** Remove the stored photo and clear it from the profile. */
  removeAvatar(): Promise<void>;
  /**
   * Re-sign the signed-in member's own photo URL.
   *
   * Called after an upload and when a screen has held a URL long enough that it
   * may have expired. Safe to call when no photo exists.
   */
  refreshAvatar(): Promise<string | null>;
  deleteAccount(): Promise<void>;
  clearError(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const repo = repository();

  useEffect(() => {
    let active = true;
    const stopAutoRefresh = startSupabaseAutoRefresh();

    void repo
      .getSession()
      .then((session) => {
        if (!active) return;
        setUser(session);
        setStatus(session ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (!active) return;
        setStatus('signed-out');
      });

    const unsubscribe = repo.onAuthStateChange((next) => {
      if (!active) return;
      setUser(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
      unsubscribe();
      stopAutoRefresh();
    };
  }, [repo]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      setBusy(true);
      setError(null);
      try {
        return await action();
      } catch (caught) {
        const message =
          caught instanceof RepositoryError || caught instanceof Error
            ? caught.message
            : 'Something went wrong. Try again.';
        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      run(async () => {
        const result = await repo.signIn(email, password);
        setUser(result.user);
        setStatus(result.user ? 'signed-in' : 'signed-out');
        return result;
      }),
    [repo, run],
  );

  const signUp = useCallback(
    (email: string, password: string, displayName: string) =>
      run(async () => {
        const result = await repo.signUp({ email, password, displayName });
        setUser(result.user);
        setStatus(result.user ? 'signed-in' : 'signed-out');
        return result;
      }),
    [repo, run],
  );

  const signOut = useCallback(
    () =>
      run(async () => {
        await repo.signOut();
        setUser(null);
        setStatus('signed-out');
      }),
    [repo, run],
  );

  const requestPasswordReset = useCallback(
    (email: string) => run(() => repo.requestPasswordReset(email)),
    [repo, run],
  );

  const updatePassword = useCallback(
    (newPassword: string) => run(() => repo.updatePassword(newPassword)),
    [repo, run],
  );

  const updateProfile = useCallback(
    (update: ProfileUpdate) =>
      run(async () => {
        if (!user) throw new RepositoryError('You need to be signed in.', 'not-authenticated');
        const profile = await repo.updateProfile(user.id, update);
        setUser((current) => (current ? { ...current, profile } : current));
        return profile;
      }),
    [repo, run, user],
  );

  const uploadAvatar = useCallback(
    (localUri: string, mimeType: string) =>
      run(async () => {
        if (!user) throw new RepositoryError('You need to be signed in.', 'not-authenticated');
        // Store the object path, then immediately sign a URL for display. The
        // path is the durable value; the URL is derived and short-lived.
        const path = await repo.uploadAvatar(user.id, localUri, mimeType);
        const stored = await repo.updateProfile(user.id, { avatarPath: path });
        const urls = await repo.resolveAvatarUrls([user.id]);
        const profile = { ...stored, avatarUrl: urls[user.id] ?? null };
        setUser((current) => (current ? { ...current, profile } : current));
        if (!profile.avatarUrl) {
          throw new RepositoryError(
            'The photo uploaded but could not be displayed. Check that the avatars bucket exists.',
            'unknown',
          );
        }
        return profile.avatarUrl;
      }),
    [repo, run, user],
  );

  const removeAvatar = useCallback(
    () =>
      run(async () => {
        if (!user) throw new RepositoryError('You need to be signed in.', 'not-authenticated');
        await repo.deleteAvatar(user.id);
        const profile = await repo.updateProfile(user.id, { avatarPath: null });
        setUser((current) => (current ? { ...current, profile: { ...profile, avatarUrl: null } } : current));
      }),
    [repo, run, user],
  );

  const refreshAvatar = useCallback(
    () =>
      run(async () => {
        if (!user) throw new RepositoryError('You need to be signed in.', 'not-authenticated');
        const urls = await repo.resolveAvatarUrls([user.id]);
        const url = urls[user.id] ?? null;
        setUser((current) =>
          current ? { ...current, profile: { ...current.profile, avatarUrl: url } } : current,
        );
        return url;
      }),
    [repo, run, user],
  );

  const deleteAccount = useCallback(
    () =>
      run(async () => {
        await repo.deleteAccount();
        setUser(null);
        setStatus('signed-out');
      }),
    [repo, run],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile: user?.profile ?? null,
      error,
      busy,
      isDemoMode: config.demoMode,
      demoReason: demoModeReason,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      uploadAvatar,
      removeAvatar,
      refreshAvatar,
      deleteAccount,
      clearError: () => setError(null),
    }),
    [
      status,
      user,
      error,
      busy,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      uploadAvatar,
      removeAvatar,
      refreshAvatar,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
