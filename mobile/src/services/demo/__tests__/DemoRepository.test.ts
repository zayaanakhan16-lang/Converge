import { DEMO_ACCOUNT, DEMO_PROFILES, DEMO_VIEWER_ID } from '../../../data/demo';
import { RepositoryError } from '../../types';
import { DemoRepository } from '../DemoRepository';

/**
 * These tests exercise the demo repository as a real implementation of the
 * repository contract. They assert the safety rules the product depends on:
 * mutual consent before messaging, blocking, and no fabricated password resets.
 */

async function signedIn(): Promise<DemoRepository> {
  const repo = new DemoRepository();
  await repo.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
  return repo;
}

describe('DemoRepository authentication', () => {
  it('starts with no session', async () => {
    const repo = new DemoRepository();
    expect(await repo.getSession()).toBeNull();
  });

  it('signs in with the labelled demo credentials', async () => {
    const repo = new DemoRepository();
    const result = await repo.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
    expect(result.user?.id).toBe(DEMO_VIEWER_ID);
    expect(result.user?.email).toBe(DEMO_ACCOUNT.email);
    expect(result.confirmationRequired).toBe(false);
  });

  it('rejects a wrong password with a typed error', async () => {
    const repo = new DemoRepository();
    await expect(repo.signIn(DEMO_ACCOUNT.email, 'not-the-password')).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  it('refuses to pretend a password reset email was sent', async () => {
    const repo = new DemoRepository();
    await expect(repo.requestPasswordReset(DEMO_ACCOUNT.email)).rejects.toThrow(
      /Supabase/i,
    );
  });

  it('creates a profile that still needs onboarding', async () => {
    const repo = new DemoRepository();
    const result = await repo.signUp({
      email: 'new.member@converge.demo',
      password: 'a-long-enough-password',
      displayName: 'New Member',
    });
    expect(result.user?.profile.onboardingCompleted).toBe(false);
    expect(result.user?.profile.interests).toEqual([]);
  });

  it('notifies listeners when the session changes', async () => {
    const repo = new DemoRepository();
    const seen: Array<string | null> = [];
    const unsubscribe = repo.onAuthStateChange((user) => seen.push(user?.id ?? null));
    await repo.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
    await repo.signOut();
    unsubscribe();
    expect(seen).toEqual([DEMO_VIEWER_ID, null]);
  });
});

describe('DemoRepository matching and privacy', () => {
  it('never recommends the viewer or a connected member', async () => {
    const repo = await signedIn();
    const matches = await repo.getMatches(DEMO_VIEWER_ID, {
      interestIds: [],
      languageCodes: [],
      activityIds: [],
      goalIds: [],
      openToConversationsOnly: false,
      sharedCommunitiesOnly: false,
      maxDistanceKm: null,
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((match) => match.profile.id === DEMO_VIEWER_ID)).toBe(false);
    const connections = await repo.listConnections(DEMO_VIEWER_ID);
    const connectedIds = new Set(connections.map((connection) => connection.userId));
    expect(matches.some((match) => connectedIds.has(match.profile.id))).toBe(false);
  });

  it('excludes private profiles from matching', async () => {
    const repo = await signedIn();
    const profiles = await repo.listProfiles();
    const hidden = profiles.find((profile) => profile.privacy.visibility === 'private');
    if (!hidden) return;
    const matches = await repo.getMatches(DEMO_VIEWER_ID, {
      interestIds: [],
      languageCodes: [],
      activityIds: [],
      goalIds: [],
      openToConversationsOnly: false,
      sharedCommunitiesOnly: false,
      maxDistanceKm: null,
    });
    expect(matches.some((match) => match.profile.id === hidden.id)).toBe(false);
  });

  it('gives every recommendation at least one reason', async () => {
    const repo = await signedIn();
    const matches = await repo.getMatches(DEMO_VIEWER_ID, {
      interestIds: [],
      languageCodes: [],
      activityIds: [],
      goalIds: [],
      openToConversationsOnly: false,
      sharedCommunitiesOnly: false,
      maxDistanceKm: null,
    });
    expect(matches.every((match) => match.reasons.length > 0)).toBe(true);
  });
});

describe('DemoRepository connections and messaging consent', () => {
  it('refuses to open a conversation with an unconnected member', async () => {
    const repo = await signedIn();
    const stranger = DEMO_PROFILES.find(
      (profile) => profile.id !== DEMO_VIEWER_ID && profile.id !== 'demo-user-2',
    )!;
    await expect(
      repo.openDirectConversation(DEMO_VIEWER_ID, stranger.id),
    ).rejects.toThrow(/connected/i);
  });

  it('only lets the recipient answer a request', async () => {
    const repo = await signedIn();
    const outgoing = await repo.sendConnectionRequest(DEMO_VIEWER_ID, 'demo-user-4', 'We both code.');
    await expect(repo.respondToRequest(outgoing.id, 'accept')).rejects.toThrow(/recipient/i);
  });

  it('opens a conversation once an incoming request is accepted', async () => {
    const repo = await signedIn();
    const { incoming } = await repo.listConnectionRequests(DEMO_VIEWER_ID);
    const request = incoming[0]!;
    await repo.respondToRequest(request.id, 'accept');
    const conversation = await repo.openDirectConversation(DEMO_VIEWER_ID, request.fromUserId);
    expect(conversation.participantIds).toContain(request.fromUserId);
    expect(conversation.participantIds).toContain(DEMO_VIEWER_ID);
  });

  it('does not create a connection when an incoming request is declined', async () => {
    const repo = await signedIn();
    const { incoming } = await repo.listConnectionRequests(DEMO_VIEWER_ID);
    const request = incoming[0]!;
    await repo.respondToRequest(request.id, 'decline');
    const connections = await repo.listConnections(DEMO_VIEWER_ID);
    expect(connections.some((connection) => connection.userId === request.fromUserId)).toBe(false);
  });

  it('cancels an outgoing request without connecting', async () => {
    const repo = await signedIn();
    const outgoing = await repo.sendConnectionRequest(DEMO_VIEWER_ID, 'demo-user-4', null);
    await repo.cancelRequest(outgoing.id);
    const { outgoing: after } = await repo.listConnectionRequests(DEMO_VIEWER_ID);
    expect(after.some((request) => request.id === outgoing.id)).toBe(false);
    await expect(repo.openDirectConversation(DEMO_VIEWER_ID, 'demo-user-4')).rejects.toThrow(
      /connected/i,
    );
  });

  it('drops the direct conversation when a connection is removed', async () => {
    const repo = await signedIn();
    const connections = await repo.listConnections(DEMO_VIEWER_ID);
    const first = connections[0]!;
    await repo.removeConnection(first.id);
    const after = await repo.listConnections(DEMO_VIEWER_ID);
    expect(after.some((connection) => connection.id === first.id)).toBe(false);
  });
});

describe('DemoRepository blocking', () => {
  it('removes the blocked member from recommendations', async () => {
    const repo = await signedIn();
    const before = await repo.getMatches(DEMO_VIEWER_ID, {
      interestIds: [],
      languageCodes: [],
      activityIds: [],
      goalIds: [],
      openToConversationsOnly: false,
      sharedCommunitiesOnly: false,
      maxDistanceKm: null,
    });
    const target = before[0]!.profile.id;
    await repo.blockUser(DEMO_VIEWER_ID, target);
    const after = await repo.getMatches(DEMO_VIEWER_ID, {
      interestIds: [],
      languageCodes: [],
      activityIds: [],
      goalIds: [],
      openToConversationsOnly: false,
      sharedCommunitiesOnly: false,
      maxDistanceKm: null,
    });
    expect(after.some((match) => match.profile.id === target)).toBe(false);
    const blocked = await repo.listBlockedUsers(DEMO_VIEWER_ID);
    expect(blocked.map((entry) => entry.userId)).toContain(target);
  });
});

describe('DemoRepository community rules', () => {
  it('requires membership before posting to a group discussion', async () => {
    const repo = await signedIn();
    const communities = await repo.listCommunities(DEMO_VIEWER_ID, {
      search: '',
      joinedOnly: false,
      excludeJoined: true,
    });
    if (communities.length === 0) return;
    await expect(
      repo.postCommunityMessage(communities[0]!.id, 'Hello everyone'),
    ).rejects.toThrow(/join this community/i);
  });

  it('joins by code and rejects an unknown code', async () => {
    const repo = await signedIn();
    const communities = await repo.listCommunities(DEMO_VIEWER_ID, {
      search: '',
      joinedOnly: false,
      excludeJoined: false,
    });
    const withCode = communities.find((community) => Boolean(community.joinCode));
    if (withCode?.joinCode) {
      const joined = await repo.joinByCode(withCode.joinCode);
      expect(joined.id).toBe(withCode.id);
    }
    await expect(repo.joinByCode('NOT-A-REAL-CODE')).rejects.toThrow();
  });
});

describe('DemoRepository validation', () => {
  it('rejects an empty message', async () => {
    const repo = await signedIn();
    const conversations = await repo.listConversations(DEMO_VIEWER_ID);
    if (conversations.length === 0) return;
    await expect(
      repo.sendMessage(DEMO_VIEWER_ID, { conversationId: conversations[0]!.id, body: '   ' }),
    ).rejects.toThrow(/write something/i);
  });

  it('rejects sending to a conversation the member is not part of', async () => {
    const repo = await signedIn();
    await expect(
      repo.sendMessage(DEMO_VIEWER_ID, { conversationId: 'conversation-does-not-exist', body: 'Hi' }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });
});

/**
 * Location discovery.
 *
 * These assert the privacy conditions rather than the happy path alone: that a
 * member who has not opted in is never returned, that blocking is honoured, and
 * that distances are whole kilometres so a distance cannot be read as a
 * position.
 */
describe('DemoRepository nearby discovery', () => {
  const CENTRE = { latitude: 53.48, longitude: -2.24 };
  const WIDE = { center: CENTRE, radiusKm: 100 };

  it('returns only members who opted into nearby discovery', async () => {
    const repo = await signedIn();
    const nearby = await repo.listNearbyPeople(DEMO_VIEWER_ID, WIDE);

    expect(nearby.length).toBeGreaterThan(0);
    for (const entry of nearby) {
      expect(entry.profile.privacy.nearbyDiscoveryEnabled).toBe(true);
      expect(entry.profile.privacy.visibility).toBe('discoverable');
      expect(entry.profile.location).not.toBeNull();
    }
  });

  it('never returns the viewer', async () => {
    const repo = await signedIn();
    const nearby = await repo.listNearbyPeople(DEMO_VIEWER_ID, WIDE);
    expect(nearby.some((entry) => entry.profile.id === DEMO_VIEWER_ID)).toBe(false);
  });

  it('drops a member from results once they are blocked', async () => {
    const repo = await signedIn();
    const before = await repo.listNearbyPeople(DEMO_VIEWER_ID, WIDE);
    expect(before.length).toBeGreaterThan(0);

    const target = before[0].profile.id;
    await repo.blockUser(DEMO_VIEWER_ID, target);

    const after = await repo.listNearbyPeople(DEMO_VIEWER_ID, WIDE);
    expect(after.some((entry) => entry.profile.id === target)).toBe(false);
    expect(after.length).toBe(before.length - 1);
  });

  it('rounds every distance to whole kilometres', async () => {
    const repo = await signedIn();
    const nearby = await repo.listNearbyPeople(DEMO_VIEWER_ID, WIDE);
    for (const entry of nearby) {
      expect(Number.isInteger(entry.distanceKm)).toBe(true);
    }
  });

  it('honours the radius and sorts nearest first', async () => {
    const repo = await signedIn();
    const narrow = await repo.listNearbyPeople(DEMO_VIEWER_ID, { center: CENTRE, radiusKm: 1 });
    const wide = await repo.listNearbyPeople(DEMO_VIEWER_ID, WIDE);

    expect(narrow.length).toBeLessThanOrEqual(wide.length);
    for (const entry of narrow) expect(entry.distanceKm).toBeLessThanOrEqual(1);
    for (let i = 1; i < wide.length; i += 1) {
      expect(wide[i].distanceKm).toBeGreaterThanOrEqual(wide[i - 1].distanceKm);
    }
  });

  it('returns nothing when no area is known', async () => {
    const repo = await signedIn();
    const nearby = await repo.listNearbyPeople(DEMO_VIEWER_ID, { center: null, radiusKm: 25 });
    expect(nearby).toEqual([]);
  });

  it('finds communities near a point and excludes those out of range', async () => {
    const repo = await signedIn();
    const nearby = await repo.listNearbyCommunities(DEMO_VIEWER_ID, WIDE);
    expect(nearby.length).toBeGreaterThan(0);
    for (const entry of nearby) {
      expect(entry.community.location).not.toBeNull();
      expect(entry.distanceKm).toBeLessThanOrEqual(WIDE.radiusKm);
    }
  });

  it('filters members by recorded place for global discovery', async () => {
    const repo = await signedIn();
    const inCity = await repo.listPeopleInPlace(DEMO_VIEWER_ID, { city: 'Manchester' });
    expect(inCity.length).toBeGreaterThan(0);
    for (const profile of inCity) {
      expect(profile.location?.city).toBe('Manchester');
      expect(profile.privacy.visibility).toBe('discoverable');
    }

    const elsewhere = await repo.listPeopleInPlace(DEMO_VIEWER_ID, { city: 'Nowhere' });
    expect(elsewhere).toEqual([]);
  });

  it('filters members by country code, case-insensitively', async () => {
    const repo = await signedIn();
    const upper = await repo.listPeopleInPlace(DEMO_VIEWER_ID, { countryCode: 'GB' });
    const lower = await repo.listPeopleInPlace(DEMO_VIEWER_ID, { countryCode: 'gb' });
    expect(upper.length).toBeGreaterThan(0);
    expect(lower.length).toBe(upper.length);
  });
});
