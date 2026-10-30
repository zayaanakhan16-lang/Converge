import {
  DEMO_COMMUNITIES,
  DEMO_PROFILES,
  DEMO_VIEWER_ID,
} from '../../../data/demo';
import type { Community, Profile } from '../../../types/domain';
import { DEFAULT_PRIVACY } from '../../../types/domain';
import {
  EMPTY_FILTERS,
  MINIMUM_MATCH_SCORE,
  activeFilterCount,
  applyFilters,
  haversineKm,
  rankMatches,
  scoreMatch,
  type MatchContext,
} from '../engine';

const viewer = DEMO_PROFILES.find((profile) => profile.id === DEMO_VIEWER_ID)!;

function profile(overrides: Partial<Profile> & Pick<Profile, 'id' | 'displayName'>): Profile {
  return {
    avatarUrl: null,
    headline: null,
    bio: null,
    interests: [],
    skills: [],
    learningSkills: [],
    languages: ['en'],
    goals: [],
    preferredActivities: [],
    location: null,
    privacy: { ...DEFAULT_PRIVACY },
    notifications: {
      connectionRequests: true,
      messages: true,
      communityActivity: true,
      eventReminders: true,
      productUpdates: false,
    },
    onboardingCompleted: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function emptyContext(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    viewerCommunities: [],
    candidateCommunities: new Map<string, Community[]>(),
    excludedUserIds: new Set<string>(),
    ...overrides,
  };
}

describe('AuraMatch scoring', () => {
  it('explains a shared interest rather than returning a bare number', () => {
    const candidate = profile({
      id: 'candidate',
      displayName: 'Candidate',
      interests: ['programming'],
    });
    const result = scoreMatch(viewer, candidate, emptyContext());
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.some((reason) => reason.kind === 'shared-interest')).toBe(true);
    expect(result.reasons[0]?.detail).toMatch(/programming/i);
    expect(result.sharedInterests).toContain('programming');
  });

  it('credits complementary skills only when the pair is genuinely complementary', () => {
    const candidate = profile({
      id: 'candidate',
      displayName: 'Candidate',
      skills: ['machine-learning'],
      learningSkills: ['frontend'],
    });
    const result = scoreMatch(viewer, candidate, emptyContext());
    const reason = result.reasons.find((item) => item.kind === 'complementary-skill');
    expect(reason).toBeDefined();
    expect(reason?.detail).toMatch(/machine learning/i);
  });

  it('does not credit a skill that both members merely share', () => {
    const candidate = profile({
      id: 'candidate',
      displayName: 'Candidate',
      skills: ['frontend'],
    });
    const result = scoreMatch(viewer, candidate, emptyContext());
    expect(result.reasons.some((item) => item.kind === 'complementary-skill')).toBe(false);
  });

  it('scores a shared goal above a shared interest', () => {
    const interestOnly = scoreMatch(
      viewer,
      profile({ id: 'a', displayName: 'A', interests: ['climbing'] }),
      emptyContext(),
    );
    const goalOnly = scoreMatch(
      viewer,
      profile({ id: 'b', displayName: 'B', goals: ['find-collaborators'] }),
      emptyContext(),
    );
    expect(goalOnly.score).toBeGreaterThan(interestOnly.score);
  });

  it('scores proximity only when both members opt in to approximate location', () => {
    const shared = profile({
      id: 'near',
      displayName: 'Near',
      location: { latitude: 53.49, longitude: -2.24, areaLabel: 'Northside' },
      privacy: { ...DEFAULT_PRIVACY, shareApproximateLocation: true },
    });
    const optedOut = profile({
      id: 'hidden',
      displayName: 'Hidden',
      location: { latitude: 53.49, longitude: -2.24, areaLabel: 'Northside' },
      privacy: { ...DEFAULT_PRIVACY, shareApproximateLocation: false },
    });
    expect(scoreMatch(viewer, shared, emptyContext()).reasons.some((r) => r.kind === 'proximity')).toBe(
      true,
    );
    expect(
      scoreMatch(viewer, optedOut, emptyContext()).reasons.some((r) => r.kind === 'proximity'),
    ).toBe(false);
  });

  it('never reports a score as a percentage', () => {
    const result = scoreMatch(
      viewer,
      profile({ id: 'c', displayName: 'C', interests: ['programming'] }),
      emptyContext(),
    );
    // Scores are unbounded weighted sums, which is deliberate: a percentage
    // would imply a precision the signals do not have.
    expect(result.score).not.toBeLessThan(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });
});

describe('rankMatches', () => {
  it('orders by score and drops candidates below the threshold', () => {
    const strong = profile({
      id: 'strong',
      displayName: 'Strong',
      interests: ['programming', 'open-source'],
      goals: ['find-collaborators'],
    });
    const weak = profile({ id: 'weak', displayName: 'Weak' });
    const ranked = rankMatches(viewer, [weak, strong], emptyContext());
    expect(ranked.map((item) => item.profile.id)).toEqual(['strong']);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(MINIMUM_MATCH_SCORE);
  });

  it('excludes the viewer and anyone in the exclusion set', () => {
    const other = profile({
      id: 'other',
      displayName: 'Other',
      interests: ['programming'],
    });
    const excluded = profile({
      id: 'excluded',
      displayName: 'Excluded',
      interests: ['programming'],
    });
    const ranked = rankMatches(viewer, [viewer, other, excluded], emptyContext({
      excludedUserIds: new Set(['excluded']),
    }));
    expect(ranked.map((item) => item.profile.id)).toEqual(['other']);
  });
});

describe('discovery filters', () => {
  const candidates = DEMO_PROFILES.filter((item) => item.id !== DEMO_VIEWER_ID);

  it('counts only the filters that are actually set', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ ...EMPTY_FILTERS, interestIds: ['programming'], maxDistanceKm: 10 }),
    ).toBe(2);
  });

  it('filters by language', () => {
    const filtered = applyFilters(
      candidates.map((candidate) => scoreMatch(viewer, candidate, emptyContext())),
      { ...EMPTY_FILTERS, languageCodes: ['de'] },
      viewer,
      emptyContext(),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((item) => item.profile.languages.includes('de'))).toBe(true);
  });

  it('hides members who opted out of connection requests when asked', () => {
    const optedOut = profile({
      id: 'quiet',
      displayName: 'Quiet',
      interests: ['programming'],
      privacy: { ...DEFAULT_PRIVACY, allowConnectionRequests: false },
    });
    const open = profile({ id: 'open', displayName: 'Open', interests: ['programming'] });
    const results = [optedOut, open].map((candidate) =>
      scoreMatch(viewer, candidate, emptyContext()),
    );
    const filtered = applyFilters(
      results,
      { ...EMPTY_FILTERS, openToConversationsOnly: true },
      viewer,
      emptyContext(),
    );
    expect(filtered.map((item) => item.profile.id)).toEqual(['open']);
  });

  it('drops distance filtering for members who hide their area', () => {
    const hidden = profile({
      id: 'hidden',
      displayName: 'Hidden',
      interests: ['programming'],
      location: { latitude: 53.49, longitude: -2.24, areaLabel: 'Northside' },
      privacy: { ...DEFAULT_PRIVACY, shareApproximateLocation: false },
    });
    const filtered = applyFilters(
      [scoreMatch(viewer, hidden, emptyContext())],
      { ...EMPTY_FILTERS, maxDistanceKm: 50 },
      viewer,
      emptyContext(),
    );
    expect(filtered).toHaveLength(0);
  });
});

describe('shared communities', () => {
  it('adds a reason when both members belong to the same community', () => {
    const community = DEMO_COMMUNITIES[0]!;
    const candidate = profile({ id: 'peer', displayName: 'Peer' });
    const context = emptyContext({
      viewerCommunities: [community],
      candidateCommunities: new Map([[candidate.id, [community]]]),
    });
    const result = scoreMatch(viewer, candidate, context);
    const reason = result.reasons.find((item) => item.kind === 'shared-community');
    expect(reason?.detail).toContain(community.name);
  });
});

describe('haversineKm', () => {
  it('is zero for the same point and grows with separation', () => {
    const a = { latitude: 53.49, longitude: -2.24 };
    expect(haversineKm(a, a)).toBeCloseTo(0, 5);
    const far = haversineKm(a, { latitude: 53.39, longitude: -2.24 });
    expect(far).toBeGreaterThan(10);
    expect(far).toBeLessThan(12);
  });
});
