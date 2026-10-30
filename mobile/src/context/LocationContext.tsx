import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { readDeviceArea, locationPermissionStatus, type LocationOutcome } from '../services/location';
import type { ApproximateLocation } from '../types/domain';
import { useAuth } from './AuthContext';

/**
 * The member's discovery area.
 *
 * Holds the coarse area the app searches from, and the permission state behind
 * it. The area is kept in memory only: it is re-read from the device on each
 * launch, and the authoritative copy lives on the profile row once the member
 * chooses to share it. Nothing is written to storage here, so a shared device
 * does not retain one member's area for the next person who signs in.
 *
 * Three distinct states are tracked, because the interface has to distinguish
 * them:
 *
 *   permission  what the operating system will allow
 *   area        where to search from, which may come from the device or from a
 *               city the member typed
 *   source      which of the two produced the current area
 */

export type LocationSource = 'device' | 'manual' | 'profile' | 'none';

export interface LocationContextValue {
  /** The area to search from, or null when none is known. */
  area: ApproximateLocation | null;
  /** Where `area` came from, so the interface can label it honestly. */
  source: LocationSource;
  permission: 'granted' | 'denied' | 'undetermined' | 'unknown';
  /** True while a device read is in flight. */
  loading: boolean;
  /** The reason the last read failed, if it did. */
  error: string | null;
  /**
   * Read the device area, prompting for permission if it has not been asked.
   *
   * Returns the outcome so a caller can react to a denial rather than having to
   * infer it from `error`.
   */
  requestDeviceArea(): Promise<LocationOutcome>;
  /** Set the area from a place the member chose or searched for. */
  setManualArea(location: ApproximateLocation): void;
  /** Adopt the area already recorded on the member's profile, if any. */
  useProfileArea(location: ApproximateLocation | null): void;
  /** Forget the area held in memory. */
  clear(): void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // The area chosen in this session, together with the member it belongs to.
  // Storing the owner lets a sign-out invalidate it without an effect: an
  // override recorded for a different member is simply not used.
  const [override, setOverride] = useState<{
    userId: string;
    location: ApproximateLocation;
    source: LocationSource;
  } | null>(null);

  const [permission, setPermission] = useState<LocationContextValue['permission']>('unknown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a second prompt being triggered while one is open, which
  // some Android builds handle by returning an immediate denial.
  const prompting = useRef(false);

  // Read the permission state on mount without prompting, so the interface can
  // show the right call to action before the member taps anything.
  useEffect(() => {
    let active = true;
    void locationPermissionStatus()
      .then((status) => {
        if (active) setPermission(status);
      })
      .catch(() => {
        if (active) setPermission('unknown');
      });
    return () => {
      active = false;
    };
  }, []);

  const userId = user?.id ?? null;

  // An area chosen this session wins over the one on the profile; the profile's
  // own area is the fallback, which is what lets a returning member see results
  // immediately. Nothing is copied between them, so there is a single source of
  // truth for each.
  const profileArea = user?.profile?.location ?? null;
  const profileSharesArea = user?.profile?.privacy.shareApproximateLocation ?? false;

  const activeOverride = override && override.userId === userId ? override : null;
  const area = activeOverride?.location ?? (profileSharesArea ? profileArea : null);
  const source: LocationSource = activeOverride
    ? activeOverride.source
    : profileSharesArea && profileArea
      ? 'profile'
      : 'none';

  const requestDeviceArea = useCallback(async (): Promise<LocationOutcome> => {
    if (prompting.current) {
      return { status: 'unavailable', message: 'A location request is already in progress.' };
    }
    prompting.current = true;
    setLoading(true);
    setError(null);
    try {
      const outcome = await readDeviceArea();
      if (outcome.status === 'ok') {
        if (userId) {
          setOverride({ userId, location: outcome.location, source: 'device' });
        }
        setPermission('granted');
      } else if (outcome.status === 'denied') {
        setPermission('denied');
        setError('Converge does not have location permission.');
      } else {
        setError(outcome.message);
      }
      return outcome;
    } finally {
      prompting.current = false;
      setLoading(false);
    }
  }, [userId]);

  const setManualArea = useCallback(
    (location: ApproximateLocation) => {
      if (!userId) return;
      setOverride({ userId, location, source: 'manual' });
      setError(null);
    },
    [userId],
  );

  const useProfileArea = useCallback(
    (location: ApproximateLocation | null) => {
      if (!userId || !location) return;
      setOverride({ userId, location, source: 'profile' });
    },
    [userId],
  );

  const clear = useCallback(() => {
    setOverride(null);
    setError(null);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      area,
      source,
      permission,
      loading,
      error,
      requestDeviceArea,
      setManualArea,
      useProfileArea,
      clear,
    }),
    [
      area,
      source,
      permission,
      loading,
      error,
      requestDeviceArea,
      setManualArea,
      useProfileArea,
      clear,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error('useLocation must be used inside a LocationProvider.');
  return value;
}
