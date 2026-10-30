import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { repository } from '../services';
import type { Profile } from '../types/domain';

/**
 * Signed profile photo URLs.
 *
 * Photos live in a private bucket, so a stored `Profile` carries no usable URL
 * until one is signed for the current viewer. Signing is a network round trip,
 * which makes it unsuitable for the render path, so it happens here and the
 * result is cached.
 *
 * The cache is a tiny external store rather than component state. Several
 * screens can ask for overlapping sets of ids at once; a store lets them share
 * one request and one result, and it keeps the signing side effect out of the
 * render phase.
 */

/** Re-sign before expiry, so a URL never goes stale while a screen is open. */
const REFRESH_AFTER_MS = 20 * 60 * 1000;

interface Entry {
  url: string;
  signedAt: number;
}

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
/** Snapshot handed to React. Replaced (never mutated) so identity signals change. */
let snapshot: Record<string, string> = {};

function publish() {
  const next: Record<string, string> = {};
  for (const [id, entry] of cache) {
    if (entry.url) next[id] = entry.url;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Record<string, string> {
  return snapshot;
}

function needsSigning(id: string): boolean {
  const entry = cache.get(id);
  return !entry || Date.now() - entry.signedAt > REFRESH_AFTER_MS;
}

/**
 * Sign the given ids, collapsing concurrent requests for overlapping sets.
 *
 * A denied photo is cached as an empty URL, so a request the database has
 * already refused is not repeated on every render.
 */
function requestSigning(ids: string[]) {
  const missing = ids.filter(needsSigning);
  if (missing.length === 0) return;

  const key = [...missing].sort().join(',');
  if (inFlight.has(key)) return;

  const promise = repository()
    .resolveAvatarUrls(missing)
    .then((urls) => {
      const signedAt = Date.now();
      for (const id of missing) {
        cache.set(id, { url: urls[id] ?? '', signedAt });
      }
      publish();
    })
    .catch(() => {
      // A failed signing request leaves the cache untouched, so the next mount
      // retries. Screens render initials in the meantime.
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
}

/**
 * Resolve displayable photo URLs for a set of profile ids.
 *
 * An id absent from the result means the viewer may not see that photo;
 * callers render the member's initials instead.
 */
export function useAvatarUrls(profileIds: string[]): Record<string, string> {
  // Join so the effect does not re-run merely because a list was rebuilt.
  const key = useMemo(() => [...new Set(profileIds)].sort().join(','), [profileIds]);
  const urls = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!key) return;
    requestSigning(key.split(','));
  }, [key]);

  return urls;
}

/** Apply a signed URL to one profile, leaving it untouched when there is none. */
export function withAvatar(profile: Profile, urls: Record<string, string>): Profile {
  const url = urls[profile.id];
  return url && url !== profile.avatarUrl ? { ...profile, avatarUrl: url } : profile;
}

/** Sign the signed-in member's own photo on mount. */
export function useRefreshOwnAvatar(userId: string | undefined) {
  const urls = useAvatarUrls(userId ? [userId] : []);
  return userId ? (urls[userId] ?? null) : null;
}
