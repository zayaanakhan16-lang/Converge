import { mapConfig } from '../constants/config';
import type { ApproximateLocation } from '../types/domain';

/**
 * Location privacy helpers.
 *
 * Converge never stores or transmits an exact device position. Coordinates are
 * snapped to a coarse grid (about 5 km) before they leave the device, which is
 * enough for "roughly the same area" matching and useless for tracking.
 */

export function snapToGrid(
  location: ApproximateLocation,
  gridDegrees: number = mapConfig.privacyGridDegrees,
): { latitude: number; longitude: number } {
  const snap = (value: number) => Math.round(value / gridDegrees) * gridDegrees;
  return {
    latitude: Number(snap(location.latitude).toFixed(4)),
    longitude: Number(snap(location.longitude).toFixed(4)),
  };
}

export function applyPrivacyGrid(location: ApproximateLocation): ApproximateLocation {
  return { ...location, ...snapToGrid(location) };
}

/** Human-readable distance, rounded so it cannot be inverted into a position. */
export function formatDistance(km: number): string {
  if (km < 1) return 'less than 1 km away';
  if (km < 10) return `${Math.round(km)} km away`;
  return `${Math.round(km / 5) * 5} km away`;
}

/** Rough distance bucket used for filtering without exposing distance. */
export function distanceBucket(km: number): 'near' | 'local' | 'regional' | 'far' {
  if (km <= 3) return 'near';
  if (km <= 12) return 'local';
  if (km <= 40) return 'regional';
  return 'far';
}
