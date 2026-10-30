import * as Location from 'expo-location';

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
  /** Display label, e.g. "Bristol, United Kingdom". */
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  countryCode?: string;
}

/**
 * Outcome of a place lookup.
 *
 * `unavailable` is a distinct state from `ok` with no results, because the two
 * need different words in the interface. A platform with no geocoder will never
 * return a match, so telling the member "no places matched" would be untrue.
 */
export type PlaceSearchOutcome =
  | { status: 'ok'; results: PlaceSearchResult[] }
  | { status: 'unavailable'; message: string };

/**
 * Search for a place by name, for manual location selection and global
 * discovery.
 *
 * Uses the platform geocoder, which resolves a place name to coordinates and
 * coordinates to place names using the provider the operating system supplies.
 * On Android that is the device's geocoding service; no third-party key is
 * involved, which is why this works without configuration.
 *
 * The coordinates returned here are the *place's* centre, not the member's
 * position. They are snapped by the caller before being stored, exactly like a
 * device reading.
 */
export async function searchPlaces(query: string): Promise<PlaceSearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { status: 'ok', results: [] };

  let matches: Location.LocationGeocodedLocation[] = [];
  try {
    matches = await Location.geocodeAsync(trimmed);
  } catch {
    // The platform has no forward geocoder. This is the case on web and on
    // Android devices without the Google location provider, and it is a
    // capability gap rather than a failure, so it is reported as one.
    return {
      status: 'unavailable',
      message: 'Place search is not available on this device.',
    };
  }

  const limited = matches.slice(0, 6);

  // Geocoding returns coordinates only, so each match is reverse geocoded to
  // obtain a readable label. These run together rather than in sequence.
  const described = await Promise.all(
    limited.map(async (match) => {
      const place = await describePlace({
        latitude: match.latitude,
        longitude: match.longitude,
      });
      return { match, place };
    }),
  );

  return {
    status: 'ok',
    results: described.map(({ match, place }) => {
      const parts = [place.city, place.countryCode].filter(Boolean);
      return {
        label: parts.length > 0 ? parts.join(', ') : trimmed,
        latitude: match.latitude,
        longitude: match.longitude,
        city: place.city,
        countryCode: place.countryCode,
      };
    }),
  };
}
