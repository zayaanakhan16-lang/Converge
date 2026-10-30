import * as Location from 'expo-location';

import { BackendUnavailableError, backend } from './backend';
import type { ApproximateLocation } from '../types/domain';
import { snapToGrid } from '../utils/geo';

/**
 * Device location.
 *
 * The device position never leaves this module unsnapped. `readDeviceArea`
 * reads the real position, snaps it to the coarse grid, and returns the snapped
 * point plus whatever place names reverse geocoding could supply. The precise
 * coordinate is discarded inside the function and is not returned, logged or
 * held in state.
 *
 * Background location is never requested. Converge does not need to know where
 * a member is when they are not using it.
 */

/** How a location read ended, so callers can respond specifically. */
export type LocationOutcome =
  | { status: 'ok'; location: ApproximateLocation }
  /** The member declined the system prompt, or the OS has the app denied. */
  | { status: 'denied' }
  /** Location services are off at the device level, or no fix could be obtained. */
  | { status: 'unavailable'; message: string };

export interface PlaceDetails {
  city?: string;
  areaLabel?: string;
  countryCode?: string;
}

/**
 * Turn a snapped coordinate into place names.
 *
 * Reverse geocoding is a best-effort enrichment: the coordinate is what
 * matters, and the place names are labels for it. A failure here is therefore
 * not a failure of the location read, which is why it is caught and reduced to
 * an empty result rather than propagating.
 *
 * The address fields are read in order of decreasing specificity, and only the
 * neighbourhood-level field is used as the area label. Street, house number and
 * postcode are never read, because they would narrow the member's position far
 * beyond the grid the coordinate was snapped to.
 */
export async function describePlace(
  location: { latitude: number; longitude: number },
): Promise<PlaceDetails> {
  try {
    const results = await Location.reverseGeocodeAsync(location);
    const place = results[0];
    if (!place) return {};
    return {
      // `district` is the neighbourhood-level field; `city` is the city. Both
      // are coarser than the grid cell, so neither reveals more than the
      // coordinate already does.
      areaLabel: place.district ?? place.subregion ?? place.city ?? undefined,
      city: place.city ?? place.subregion ?? undefined,
      countryCode: place.isoCountryCode?.toUpperCase() ?? undefined,
    };
  } catch {
    // Offline, rate limited, or no match for the coordinate. The area label is
    // simply absent and the member can type one.
    return {};
  }
}

/**
 * Ask for location permission, explaining why first.
 *
 * The caller is expected to have shown the explanation already; this only
 * triggers the system prompt, and reports whether it was granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

/** The current permission state, without prompting. */
export async function locationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Read the device area.
 *
 * Resolves to a coarse, grid-snapped location with place names where the
 * platform could supply them. Every failure mode is reported as a distinct
 * status so the interface can say what actually happened rather than showing a
 * generic error.
 */
export async function readDeviceArea(): Promise<LocationOutcome> {
  let granted: boolean;
  try {
    granted = await requestLocationPermission();
  } catch {
    return { status: 'unavailable', message: 'Location permission could not be requested.' };
  }
  if (!granted) return { status: 'denied' };

  try {
    // Location services can be switched off at the device level even with
    // permission granted, which `hasServicesEnabledAsync` distinguishes from a
    // permission problem.
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        status: 'unavailable',
        message: 'Location services are switched off on this device.',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      // Low accuracy is deliberate. The coordinate is about to be snapped to a
      // 5 km grid, so a high-accuracy fix would cost battery and time to produce
      // precision that is immediately thrown away.
      accuracy: Location.Accuracy.Low,
    });

    const snapped = snapToGrid({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    // Reverse geocode the snapped point, not the raw fix, so the place name
    // cannot be more precise than the coordinate that is kept.
    const place = await describePlace(snapped);

    return {
      status: 'ok',
      location: {
        ...snapped,
        areaLabel: place.areaLabel ?? place.city,
        city: place.city,
        countryCode: place.countryCode,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error && /timeout/i.test(error.message)
        ? 'No location fix could be obtained. Move somewhere with a clearer view of the sky and try again.'
        : 'Your location could not be read. You can search for a city instead.';
    return { status: 'unavailable', message };
  }
}

export interface PlaceSearchResult {
  /** Display label, e.g. "Manchester, England, United Kingdom". */
  label: string;
  /** The place name on its own, e.g. "Manchester". */
  name: string;
  /** How specific the place is, so the interface can describe it. */
  kind: 'country' | 'region' | 'city' | 'neighbourhood' | 'other';
  latitude: number;
  longitude: number;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

/**
 * Outcome of a place lookup.
 *
 * `unavailable` is deliberately distinct from an empty result list. A platform
 * or deployment with no geocoder will never return a match, so telling the
 * member "nothing matched" would be untrue; the reason is carried instead so
 * the screen can say what is actually wrong.
 */
export type PlaceSearchOutcome =
  | { status: 'ok'; results: PlaceSearchResult[] }
  | { status: 'unavailable'; message: string };

/**
 * Search for a place by name.
 *
 * The lookup runs on the Converge backend, not on the device. Keeping it there
 * means a provider key is never shipped inside the app bundle, the provider's
 * rate limit is enforced in one place, and repeated typing is absorbed by a
 * server-side cache rather than hitting the provider each keystroke.
 *
 * This is a separate concern from `readDeviceArea`. That function answers "where
 * is this device, coarsely"; this one answers "where is this named place". A
 * member can use this one without ever granting location permission.
 */
export async function searchPlaces(
  query: string,
  options: { limit?: number; kind?: PlaceSearchResult['kind'] } = {},
): Promise<PlaceSearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { status: 'ok', results: [] };

  try {
    const results = await backend.searchPlaces({
      query: trimmed,
      limit: options.limit,
      kind: options.kind,
    });
    return { status: 'ok', results };
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return {
        status: 'unavailable',
        message:
          'Place search needs the Converge backend. Set EXPO_PUBLIC_BACKEND_URL, then try again.',
      };
    }
    // A provider failure is reported rather than shown as "no matches", so a
    // member is never told a place does not exist when the lookup simply failed.
    return {
      status: 'unavailable',
      message:
        error instanceof Error && error.message
          ? error.message
          : 'That place could not be looked up. Check your connection and try again.',
    };
  }
}
