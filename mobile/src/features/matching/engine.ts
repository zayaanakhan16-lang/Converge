import {
  labelForActivity,
  labelForGoal,
  labelForInterest,
  labelForLanguage,
  labelForSkill,
} from '../../constants/taxonomy';
import type {
  ApproximateLocation,
  Community,
  MatchReason,
  MatchResult,
  Profile,
} from '../../types/domain';

/**
 * AuraMatch scoring.
 *
 * The engine is deliberately explainable: every recommendation carries the
 * reasons that produced it, and the score is never surfaced to users as a
 * percentage. Weights are additive so a single strong signal can carry a
 * recommendation on its own.
 *
 * This module is mirrored by `backend/app/services/matching.py`. The backend is
 * authoritative when connected; this implementation keeps the app functional
 * offline and in demo mode.
 */

export const MATCH_WEIGHTS = {
  sharedInterest: 1.0,
  complementarySkill: 1.5,
  sharedGoal: 1.8,
  languageCompatibility: 1.2,
  sharedActivity: 0.8,
  sharedCommunity: 1.3,
  proximity: 0.6,
} as const;

/** A recommendation needs at least this much signal to be shown. */
export const MINIMUM_MATCH_SCORE = 1.6;

const PROXIMITY_FULL_SCORE_KM = 2;
const PROXIMITY_ZERO_SCORE_KM = 25;

export interface MatchContext {
  /** Communities the viewer belongs to, used for shared-community signals. */
  viewerCommunities: Community[];
  /** Communities each candidate belongs to, keyed by profile id. */
  candidateCommunities: Map<string, Community[]>;
  /** Connected and blocked users are excluded from recommendations. */
  excludedUserIds?: Set<string>;
}

export function haversineKm(a: ApproximateLocation, b: ApproximateLocation): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function intersection(a: readonly string[], b: readonly string[]): string[] {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
}

/**
 * Skills that complement rather than duplicate: something the viewer offers
 * that the candidate wants to learn, or the reverse.
 */
function complementarySkills(
  viewer: Profile,
  candidate: Profile,
): { matched: string[]; candidateHelpsWith: string[] } {
  const viewerOffersCandidateWants = intersection(viewer.skills, candidate.learningSkills);
  const candidateOffersViewerWants = intersection(candidate.skills, viewer.learningSkills);
  return {
    matched: [...new Set([...viewerOffersCandidateWants, ...candidateOffersViewerWants])],
    candidateHelpsWith: candidateOffersViewerWants,
  };
}

function languageSignal(
  viewer: Profile,
  candidate: Profile,
): { shared: string[]; score: number; reason: MatchReason | null } {
  const shared = intersection(viewer.languages, candidate.languages);
  if (shared.length > 0) {
    return {
      shared,
      score: MATCH_WEIGHTS.languageCompatibility,
      reason: {
        kind: 'language-compatibility',
        detail:
          shared.length === 1
            ? `You both speak ${labelForLanguage(shared[0])}.`
            : `You share ${shared.length} languages, including ${labelForLanguage(shared[0])}.`,
      },
    };
  }
  // Different languages still work when both are covered by translation.
  return {
    shared,
    score: MATCH_WEIGHTS.languageCompatibility * 0.4,
    reason: {
      kind: 'language-compatibility',
      detail: 'You speak different languages, but in-app translation covers both.',
    },
  };
}

function proximitySignal(
  viewer: Profile,
  candidate: Profile,
): { score: number; reason: MatchReason | null } {
  if (
    !viewer.privacy.shareApproximateLocation ||
    !candidate.privacy.shareApproximateLocation ||
    !viewer.location ||
    !candidate.location
  ) {
    return { score: 0, reason: null };
  }
  const distance = haversineKm(viewer.location, candidate.location);
  if (distance > PROXIMITY_ZERO_SCORE_KM) return { score: 0, reason: null };
  const ratio =
    distance <= PROXIMITY_FULL_SCORE_KM
      ? 1
      : 1 -
        (distance - PROXIMITY_FULL_SCORE_KM) /
          (PROXIMITY_ZERO_SCORE_KM - PROXIMITY_FULL_SCORE_KM);
  const area = candidate.location.areaLabel ?? 'your area';
  return {
    score: MATCH_WEIGHTS.proximity * ratio,
    reason: {
      kind: 'proximity',
      detail:
        distance <= PROXIMITY_FULL_SCORE_KM
          ? `Based in ${area}, close to you.`
          : `Both based around ${area}, roughly ${Math.round(distance)} km apart.`,
    },
  };
}

export function scoreMatch(
  viewer: Profile,
  candidate: Profile,
  context: MatchContext,
): MatchResult {
  const reasons: MatchReason[] = [];
  let score = 0;

  const sharedInterests = intersection(viewer.interests, candidate.interests);
  if (sharedInterests.length > 0) {
    score += MATCH_WEIGHTS.sharedInterest * Math.min(sharedInterests.length, 3);
    reasons.push({
      kind: 'shared-interest',
      detail:
        sharedInterests.length === 1
          ? `Both interested in ${labelForInterest(sharedInterests[0]).toLowerCase()}.`
          : `${sharedInterests.length} shared interests, including ${labelForInterest(
              sharedInterests[0],
            ).toLowerCase()}.`,
    });
  }

  const skills = complementarySkills(viewer, candidate);
  if (skills.matched.length > 0) {
    score += MATCH_WEIGHTS.complementarySkill * Math.min(skills.matched.length, 2);
    reasons.push({
      kind: 'complementary-skill',
      detail:
        skills.candidateHelpsWith.length > 0
          ? `${candidate.displayName} can help with ${labelForSkill(
              skills.candidateHelpsWith[0],
            ).toLowerCase()}.`
          : `Your ${labelForSkill(skills.matched[0]).toLowerCase()} matches what they want to learn.`,
    });
  }

  const sharedGoals = intersection(viewer.goals, candidate.goals);
  if (sharedGoals.length > 0) {
    score += MATCH_WEIGHTS.sharedGoal * Math.min(sharedGoals.length, 2);
    reasons.push({
      kind: 'shared-goal',
      detail: `You are both looking to ${labelForGoal(sharedGoals[0]).toLowerCase()}.`,
    });
  }

  const language = languageSignal(viewer, candidate);
  score += language.score;
  if (language.reason) reasons.push(language.reason);

  const sharedActivities = intersection(
    viewer.preferredActivities,
    candidate.preferredActivities,
  );
  if (sharedActivities.length > 0) {
    score += MATCH_WEIGHTS.sharedActivity * Math.min(sharedActivities.length, 2);
    reasons.push({
      kind: 'shared-activity',
      detail: `Both open to ${labelForActivity(sharedActivities[0]).toLowerCase()}.`,
    });
  }

  const candidateCommunities = context.candidateCommunities.get(candidate.id) ?? [];
  const viewerCommunityIds = new Set(context.viewerCommunities.map((c) => c.id));
  const sharedCommunityObjects = candidateCommunities.filter((c) =>
    viewerCommunityIds.has(c.id),
  );
  const sharedCommunities = sharedCommunityObjects.map((c) => c.name);
  if (sharedCommunityObjects.length > 0) {
    score += MATCH_WEIGHTS.sharedCommunity * Math.min(sharedCommunityObjects.length, 2);
    reasons.push({
      kind: 'shared-community',
      detail:
        sharedCommunityObjects.length === 1
          ? `You are both members of ${sharedCommunityObjects[0].name}.`
          : `You share ${sharedCommunityObjects.length} communities.`,
    });
  }

  const proximity = proximitySignal(viewer, candidate);
  score += proximity.score;
  if (proximity.reason) reasons.push(proximity.reason);

  return {
    profile: candidate,
    score: Math.round(score * 100) / 100,
    reasons,
    sharedInterests,
    sharedGoals,
    sharedActivities,
    sharedCommunities,
    sharedLanguages: language.shared,
  };
}

/** Rank candidates, filtering out excluded users and weak matches. */
export function rankMatches(
  viewer: Profile,
  candidates: Profile[],
  context: MatchContext,
): MatchResult[] {
  const excluded = context.excludedUserIds ?? new Set<string>();
  return candidates
    .filter((candidate) => candidate.id !== viewer.id && !excluded.has(candidate.id))
    .map((candidate) => scoreMatch(viewer, candidate, context))
    .filter((result) => result.score >= MINIMUM_MATCH_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.profile.displayName.localeCompare(b.profile.displayName);
    });
}

export interface DiscoverFilters {
  interestIds: string[];
  languageCodes: string[];
  activityIds: string[];
  goalIds: string[];
  /** Only show members who are open to conversations right now. */
  openToConversationsOnly: boolean;
  /** Only show members who share at least one of the viewer's communities. */
  sharedCommunitiesOnly: boolean;
  /** Maximum distance in km; ignored when either side hides location. */
  maxDistanceKm: number | null;
}

export const EMPTY_FILTERS: DiscoverFilters = {
  interestIds: [],
  languageCodes: [],
  activityIds: [],
  goalIds: [],
  openToConversationsOnly: false,
  sharedCommunitiesOnly: false,
  maxDistanceKm: null,
};

export function activeFilterCount(filters: DiscoverFilters): number {
  let count = 0;
  if (filters.interestIds.length) count += 1;
  if (filters.languageCodes.length) count += 1;
  if (filters.activityIds.length) count += 1;
  if (filters.goalIds.length) count += 1;
  if (filters.openToConversationsOnly) count += 1;
  if (filters.sharedCommunitiesOnly) count += 1;
  if (filters.maxDistanceKm !== null) count += 1;
  return count;
}

export function applyFilters(
  results: MatchResult[],
  filters: DiscoverFilters,
  viewer: Profile,
  context: MatchContext,
): MatchResult[] {
  return results.filter((result) => {
    const { profile } = result;
    if (
      filters.interestIds.length &&
      !intersection(filters.interestIds, profile.interests).length
    ) {
      return false;
    }
    if (
      filters.languageCodes.length &&
      !intersection(filters.languageCodes, profile.languages).length
    ) {
      return false;
    }
    if (
      filters.activityIds.length &&
      !intersection(filters.activityIds, profile.preferredActivities).length
    ) {
      return false;
    }
    if (filters.goalIds.length && !intersection(filters.goalIds, profile.goals).length) {
      return false;
    }
    if (filters.openToConversationsOnly && !profile.privacy.allowConnectionRequests) {
      return false;
    }
    if (filters.sharedCommunitiesOnly && result.sharedCommunities.length === 0) {
      return false;
    }
    if (filters.maxDistanceKm !== null) {
      if (
        !viewer.privacy.shareApproximateLocation ||
        !profile.privacy.shareApproximateLocation ||
        !viewer.location ||
        !profile.location
      ) {
        return false;
      }
      if (haversineKm(viewer.location, profile.location) > filters.maxDistanceKm) return false;
    }
    if (context.excludedUserIds?.has(profile.id)) return false;
    return true;
  });
}

/** One-sentence explanation used by the coach prompt and request composer. */
export function suggestionSentence(result: MatchResult): string {
  if (result.reasons.length === 0) return 'You appear in the same community spaces.';
  return result.reasons[0].detail;
}
