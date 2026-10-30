import { backendConfig, aiUnavailableReason } from '../constants/config';
import type { MatchReason, MatchResult, Profile } from '../types/domain';

/**
 * Client for the Converge Python backend.
 *
 * Every AI feature degrades to a clearly-labelled "unavailable" state when the
 * backend is not configured. No function here fabricates a model response.
 */

export class BackendUnavailableError extends Error {
  constructor(message: string = aiUnavailableReason ?? 'The Converge backend is unavailable.') {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!backendConfig.isConfigured) throw new BackendUnavailableError();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), backendConfig.requestTimeoutMs);
  try {
    const response = await fetch(`${backendConfig.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Converge backend returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface CoachTurn {
  role: 'user' | 'coach';
  content: string;
}

export interface CoachFeedback {
  /** Short observations, each tied to a specific part of the message. */
  strengths: string[];
  improvements: string[];
  /** One concrete rewrite the user can send instead. */
  suggestedRevision: string;
  /** A single next step, so the advice is actionable. */
  nextStep: string;
  /** True when the model produced this; false when the rule-based coach did. */
  generatedByModel: boolean;
  provider: string;
}

export interface CoachScenario {
  id: string;
  title: string;
  description: string;
  /** What the user is practising, e.g. "introducing yourself". */
  focus: string;
  openingPrompt: string;
}

export interface TranslationResult {
  text: string;
  provider: string;
  wasTranslated: boolean;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranscriptionResult {
  text: string;
  provider: string;
  language: string | null;
  /** Confidence in the 0-1 range, when the provider reports one. */
  confidence: number | null;
}

/** One place returned by the Converge geocoding endpoint. */
export interface PlaceResult {
  label: string;
  name: string;
  kind: 'country' | 'region' | 'city' | 'neighbourhood' | 'other';
  latitude: number;
  longitude: number;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

/** Whether the backend has a usable geocoder, and which one. */
export interface PlaceProviderInfo {
  enabled: boolean;
  provider: string | null;
  kinds: string[];
}

export const backend = {
  /**
   * Search for a place by name.
   *
   * The geocoder runs on the backend rather than the device. Two reasons: the
   * provider key stays server-side where it cannot be extracted from the app
   * bundle, and the request is rate limited centrally so one client cannot
   * exhaust a shared quota.
   *
   * An empty array means the provider answered and recognised nothing. A
   * provider that could not be reached throws, so the caller never mistakes a
   * failure for "no such place".
   */
  async searchPlaces(input: {
    query: string;
    limit?: number;
    kind?: PlaceResult['kind'];
  }): Promise<PlaceResult[]> {
    const params = new URLSearchParams({ q: input.query });
    if (input.limit) params.set('limit', String(input.limit));
    if (input.kind) params.set('kind', input.kind);
    const data = await request<{
      query: string;
      provider: string;
      results: Array<{
        label: string;
        name: string;
        kind: PlaceResult['kind'];
        latitude: number;
        longitude: number;
        city: string | null;
        region: string | null;
        country: string | null;
        country_code: string | null;
      }>;
    }>(`/api/v1/places/search?${params.toString()}`);
    return data.results.map((place) => ({
      label: place.label,
      name: place.name,
      kind: place.kind,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.city,
      region: place.region,
      country: place.country,
      countryCode: place.country_code,
    }));
  },

  async placeProvider(): Promise<PlaceProviderInfo> {
    return request<PlaceProviderInfo>('/api/v1/places/providers');
  },

  async health(): Promise<{ status: string; version: string; features: string[] }> {
    return request('/health');
  },

  async coachScenarios(): Promise<CoachScenario[]> {
    const data = await request<{ scenarios: CoachScenario[] }>('/api/v1/coach/scenarios');
    return data.scenarios;
  },

  async coachFeedback(input: {
    scenarioId: string;
    message: string;
    /** Optional context so feedback can reference the match explanation. */
    matchContext?: string[];
    targetLanguage?: string;
  }): Promise<CoachFeedback> {
    const data = await request<{
      strengths: string[];
      improvements: string[];
      suggested_revision: string;
      next_step: string;
      generated_by_model: boolean;
      provider: string;
    }>('/api/v1/coach/feedback', {
      method: 'POST',
      body: JSON.stringify({
        scenario_id: input.scenarioId,
        message: input.message,
        match_context: input.matchContext ?? [],
        target_language: input.targetLanguage ?? null,
      }),
    });
    return {
      strengths: data.strengths,
      improvements: data.improvements,
      suggestedRevision: data.suggested_revision,
      nextStep: data.next_step,
      generatedByModel: data.generated_by_model,
      provider: data.provider,
    };
  },

  async translate(input: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslationResult> {
    const data = await request<{
      text: string;
      provider: string;
      was_translated: boolean;
      source_language: string;
      target_language: string;
    }>('/api/v1/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: input.text,
        source_language: input.sourceLanguage,
        target_language: input.targetLanguage,
      }),
    });
    return {
      text: data.text,
      provider: data.provider,
      wasTranslated: data.was_translated,
      sourceLanguage: data.source_language,
      targetLanguage: data.target_language,
    };
  },

  async transcribe(input: {
    /** Base64-encoded audio. Kept small: voice notes are capped at 2 minutes. */
    audioBase64: string;
    mimeType: string;
    languageHint?: string;
  }): Promise<TranscriptionResult> {
    return request<TranscriptionResult>('/api/v1/transcribe', {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: input.audioBase64,
        mime_type: input.mimeType,
        language_hint: input.languageHint ?? null,
      }),
    });
  },

  /**
   * Server-side AuraMatch scoring.
   *
   * The backend owns the weights so they can be tuned without an app release.
   * It receives the profiles the client is already allowed to read and returns
   * scores with their reasons. When it is unreachable the caller keeps the
   * result from the local engine, which uses the same weights.
   */
  async scoreMatches(input: {
    viewer: Profile;
    candidates: Profile[];
    /** Community id lists keyed by profile id. */
    communities: Record<string, string[]>;
  }): Promise<MatchResult[]> {
    const data = await request<{
      results: Array<{
        profile_id: string;
        score: number;
        reasons: MatchReason[];
        shared_interests: string[];
        shared_goals: string[];
        shared_activities: string[];
        shared_communities: string[];
        shared_languages: string[];
      }>;
    }>('/api/v1/match', {
      method: 'POST',
      body: JSON.stringify({
        viewer: toMatchProfile(input.viewer, input.communities[input.viewer.id] ?? []),
        candidates: input.candidates.map((candidate) =>
          toMatchProfile(candidate, input.communities[candidate.id] ?? []),
        ),
      }),
    });

    const byId = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
    return data.results.flatMap((result) => {
      const profile = byId.get(result.profile_id);
      if (!profile) return [];
      return [
        {
          profile,
          score: result.score,
          reasons: result.reasons,
          sharedInterests: result.shared_interests,
          sharedGoals: result.shared_goals,
          sharedActivities: result.shared_activities,
          sharedCommunities: result.shared_communities,
          sharedLanguages: result.shared_languages,
        },
      ];
    });
  },
};

/** Projects a profile onto the shape the matching endpoint expects. */
function toMatchProfile(profile: Profile, communityIds: string[]) {
  return {
    id: profile.id,
    display_name: profile.displayName,
    headline: profile.headline,
    interests: profile.interests,
    skills: profile.skills,
    learning_skills: profile.learningSkills,
    languages: profile.languages,
    goals: profile.goals,
    preferred_activities: profile.preferredActivities,
    community_ids: communityIds,
    area_label: profile.location?.areaLabel ?? null,
    latitude: profile.privacy.shareApproximateLocation ? (profile.location?.latitude ?? null) : null,
    longitude: profile.privacy.shareApproximateLocation ? (profile.location?.longitude ?? null) : null,
    shares_approximate_location: profile.privacy.shareApproximateLocation,
    visibility: profile.privacy.visibility,
  };
}
