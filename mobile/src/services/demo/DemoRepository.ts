import {
  DEMO_ACCOUNT,
  DEMO_BLOCKED_USER_IDS,
  DEMO_COMMUNITIES,
  DEMO_COMMUNITY_MEMBERS,
  DEMO_CONNECTIONS,
  DEMO_CONVERSATIONS,
  DEMO_EVENTS,
  DEMO_MEMBERSHIPS,
  DEMO_MESSAGES,
  DEMO_PENDING_REQUESTS,
  DEMO_PROFILES,
  DEMO_VIEWER_ID,
} from '../../data/demo';
import {
  applyFilters,
  rankMatches,
  type DiscoverFilters,
  type MatchContext,
} from '../../features/matching/engine';
import { snapToGrid } from '../../utils/geo';
import type {
  AppNotification,
  BlockedUser,
  Community,
  CommunityEvent,
  CommunityMembership,
  Connection,
  ConnectionRequest,
  Conversation,
  MatchResult,
  Message,
  Profile,
  Report,
  ReportReason,
  SessionUser,
} from '../../types/domain';
import { DEFAULT_NOTIFICATIONS, DEFAULT_PRIVACY } from '../../types/domain';
import {
  RepositoryError,
  type AuthResult,
  type CommunityQuery,
  type CreateCommunityInput,
  type CreateEventInput,
  type EventQuery,
  type ProfileUpdate,
  type Repository,
  type SendMessageInput,
  type SignUpInput,
} from '../types';

/**
 * In-memory repository used when Supabase is not configured.
 *
 * It implements the same contract as the Supabase repository so every screen,
 * navigation path and validation rule can be exercised without credentials.
 * It never touches the network and never pretends a remote write succeeded.
 */

const nowIso = () => new Date().toISOString();
const delay = (ms = 90) => new Promise((resolve) => setTimeout(resolve, ms));

interface DemoState {
  viewer: SessionUser | null;
  profiles: Map<string, Profile>;
  communities: Community[];
  memberships: Map<string, CommunityMembership>;
  communityMembers: Map<string, string[]>;
  events: CommunityEvent[];
  attending: Set<string>;
  requests: ConnectionRequest[];
  connections: Connection[];
  conversations: Conversation[];
  messages: Message[];
  blocked: Set<string>;
  notifications: AppNotification[];
  reports: Report[];
  communityMessages: Map<string, Message[]>;
  passwords: Map<string, string>;
}

function initialState(): DemoState {
  return {
    viewer: null,
    profiles: new Map(DEMO_PROFILES.map((profile) => [profile.id, structuredClone(profile)])),
    communities: structuredClone(DEMO_COMMUNITIES),
    memberships: new Map(DEMO_MEMBERSHIPS.map((m) => [m.communityId, structuredClone(m)])),
    communityMembers: new Map(
      Object.entries(DEMO_COMMUNITY_MEMBERS).map(([id, members]) => [id, [...members]]),
    ),
    events: structuredClone(DEMO_EVENTS),
    attending: new Set(['event-1']),
    requests: structuredClone(DEMO_PENDING_REQUESTS),
    connections: DEMO_CONNECTIONS.map((c, index) => ({
      id: `connection-${index + 1}`,
      userId: c.userId,
      connectedAt: c.connectedAt,
      originRequestId: null,
    })),
    conversations: structuredClone(DEMO_CONVERSATIONS),
    messages: structuredClone(DEMO_MESSAGES),
    blocked: new Set(DEMO_BLOCKED_USER_IDS),
    notifications: [
      {
        id: 'notification-1',
        kind: 'connection-request',
        title: 'New connection request',
        body: 'Diego Salazar would like to connect.',
        createdAt: '2026-10-27T14:12:00.000Z',
        readAt: null,
        target: { screen: 'Connections', params: { tab: 'incoming' } },
      },
      {
        id: 'notification-2',
        kind: 'message',
        title: 'Ravi Chandran replied',
        body: 'Happy to look at that on Saturday.',
        createdAt: '2026-10-29T20:14:00.000Z',
        readAt: null,
        target: { screen: 'Chat', params: { conversationId: 'conversation-1' } },
      },
      {
        id: 'notification-3',
        kind: 'event',
        title: 'Wednesday build night',
        body: 'Starts at 18:30 at Northside Library, Room 2.',
        createdAt: '2026-10-30T07:00:00.000Z',
        readAt: '2026-10-30T07:30:00.000Z',
        target: { screen: 'EventDetail', params: { eventId: 'event-1' } },
      },
    ],
    reports: [],
    communityMessages: new Map([
      [
        'community-1',
        [
          {
            id: 'community-message-1',
            conversationId: 'community-1',
            senderId: 'demo-user-6',
            body: 'Reminder: Wednesday build night moved to Room 2, the main hall is booked.',
            createdAt: '2026-10-28T17:00:00.000Z',
            state: 'sent',
            translation: null,
            attachments: [],
            voiceNoteSeconds: null,
            waveform: null,
          },
          {
            id: 'community-message-2',
            conversationId: 'community-1',
            senderId: 'demo-user-2',
            body: 'I will bring a spare laptop for anyone who needs one.',
            createdAt: '2026-10-29T09:12:00.000Z',
            state: 'sent',
            translation: null,
            attachments: [],
            voiceNoteSeconds: null,
            waveform: null,
          },
        ],
      ],
    ]),
    passwords: new Map([[DEMO_ACCOUNT.email.toLowerCase(), DEMO_ACCOUNT.password]]),
  };
}

export class DemoRepository implements Repository {
  readonly kind = 'demo' as const;

  private state = initialState();

  private listeners = new Set<(user: SessionUser | null) => void>();

  private messageListeners = new Map<string, Set<(message: Message) => void>>();

  private nextId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private requireViewer(): SessionUser {
    if (!this.state.viewer) {
      throw new RepositoryError('You need to be signed in to do that.', 'not-authenticated');
    }
    return this.state.viewer;
  }

  private requireProfile(userId: string): Profile {
    const profile = this.state.profiles.get(userId);
    if (!profile) throw new RepositoryError('That profile no longer exists.', 'not-found');
    return profile;
  }

  private emit(user: SessionUser | null): void {
    for (const listener of this.listeners) listener(user);
  }

  private buildMatchContext(viewerId: string): MatchContext {
    const viewerCommunities = this.state.communities.filter((community) =>
      (this.state.communityMembers.get(community.id) ?? []).includes(viewerId),
    );
    const candidateCommunities = new Map<string, Community[]>();
    for (const community of this.state.communities) {
      for (const memberId of this.state.communityMembers.get(community.id) ?? []) {
        const list = candidateCommunities.get(memberId) ?? [];
        list.push(community);
        candidateCommunities.set(memberId, list);
      }
    }
    const excluded = new Set<string>([
      ...this.state.blocked,
      ...this.state.connections.map((c) => c.userId),
    ]);
    for (const request of this.state.requests) {
      if (request.status !== 'pending') continue;
      if (request.fromUserId === viewerId) excluded.add(request.toUserId);
      if (request.toUserId === viewerId) excluded.add(request.fromUserId);
    }
    return { viewerCommunities, candidateCommunities, excludedUserIds: excluded };
  }

  private connectionStateFor(
    viewerId: string,
    otherId: string,
  ): 'none' | 'pending-outgoing' | 'pending-incoming' | 'connected' | 'blocked' {
    if (this.state.blocked.has(otherId)) return 'blocked';
    if (this.state.connections.some((c) => c.userId === otherId)) return 'connected';
    const outgoing = this.state.requests.some(
      (r) => r.status === 'pending' && r.fromUserId === viewerId && r.toUserId === otherId,
    );
    if (outgoing) return 'pending-outgoing';
    const incoming = this.state.requests.some(
      (r) => r.status === 'pending' && r.fromUserId === otherId && r.toUserId === viewerId,
    );
    if (incoming) return 'pending-incoming';
    return 'none';
  }

  // ---- auth -------------------------------------------------------------

  async getSession(): Promise<SessionUser | null> {
    await delay(30);
    return this.state.viewer;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    await delay();
    const normalised = email.trim().toLowerCase();
    const expected = this.state.passwords.get(normalised);
    if (!expected || expected !== password) {
      throw new RepositoryError(
        'That email and password combination was not recognised.',
        'not-authenticated',
      );
    }
    const profile = this.requireProfile(DEMO_VIEWER_ID);
    const user: SessionUser = { id: profile.id, email: normalised, profile };
    this.state.viewer = user;
    this.emit(user);
    return { user, confirmationRequired: false };
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    await delay();
    const normalised = input.email.trim().toLowerCase();
    if (this.state.passwords.has(normalised)) {
      throw new RepositoryError('An account already exists for that email.', 'conflict');
    }
    this.state.passwords.set(normalised, input.password);
    const id = this.nextId('demo-user');
    const profile: Profile = {
      id,
      displayName: input.displayName.trim(),
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
      notifications: { ...DEFAULT_NOTIFICATIONS },
      onboardingCompleted: false,
      createdAt: nowIso(),
    };
    this.state.profiles.set(id, profile);
    const user: SessionUser = { id, email: normalised, profile };
    this.state.viewer = user;
    this.emit(user);
    return { user, confirmationRequired: false };
  }

  async signOut(): Promise<void> {
    await delay(40);
    this.state.viewer = null;
    this.emit(null);
  }

  async requestPasswordReset(email: string): Promise<void> {
    await delay();
    void email;
    // Demo mode has no mail transport. Failing loudly is better than pretending
    // an email was sent.
    throw new RepositoryError(
      'Password recovery needs a configured Supabase project. Add credentials to .env to enable it.',
      'not-permitted',
    );
  }

  async updatePassword(): Promise<void> {
    throw new RepositoryError(
      'Password changes need a configured Supabase project.',
      'not-permitted',
    );
  }

  async deleteAccount(): Promise<void> {
    const viewer = this.requireViewer();
    this.state.profiles.delete(viewer.id);
    this.state.viewer = null;
    this.emit(null);
  }

  onAuthStateChange(listener: (user: SessionUser | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- profiles ---------------------------------------------------------

  async getProfile(userId: string): Promise<Profile | null> {
    await delay(20);
    return this.state.profiles.get(userId) ?? null;
  }

  async listProfiles(options?: { excludeIds?: string[] }): Promise<Profile[]> {
    await delay();
    const excluded = new Set(options?.excludeIds ?? []);
    return [...this.state.profiles.values()].filter(
      (profile) => !excluded.has(profile.id) && profile.privacy.showInCommunityLists,
    );
  }

  async updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    await delay(60);
    const current = this.requireProfile(userId);
    const next: Profile = {
      ...current,
      ...update,
      location:
        update.location === undefined
          ? current.location
          : update.location
            ? { ...update.location, ...snapToGrid(update.location) }
            : null,
      privacy: { ...current.privacy, ...(update.privacy ?? {}) },
      notifications: { ...current.notifications, ...(update.notifications ?? {}) },
    };
    this.state.profiles.set(userId, next);
    if (this.state.viewer?.id === userId) {
      this.state.viewer = { ...this.state.viewer, profile: next };
      this.emit(this.state.viewer);
    }
    return next;
  }

  async uploadAvatar(): Promise<string> {
    throw new RepositoryError(
      'Photo upload needs a configured Supabase project and storage bucket.',
      'not-permitted',
    );
  }

  // ---- matching ---------------------------------------------------------

  async getMatches(viewerId: string, filters: DiscoverFilters): Promise<MatchResult[]> {
    await delay(140);
    const viewer = this.requireProfile(viewerId);
    const context = this.buildMatchContext(viewerId);
    const candidates = [...this.state.profiles.values()];
    const ranked = rankMatches(viewer, candidates, context);
    return applyFilters(ranked, filters, viewer, context);
  }

  // ---- communities ------------------------------------------------------

  async listCommunities(viewerId: string, query: CommunityQuery): Promise<Community[]> {
    await delay();
    const joinedIds = new Set(
      [...this.state.memberships.entries()]
        .filter(([, membership]) => membership.state === 'member')
        .map(([id]) => id),
    );
    let list = this.state.communities.filter(
      (community) => !community.isPrivate || joinedIds.has(community.id),
    );
    if (query.joinedOnly) list = list.filter((c) => joinedIds.has(c.id));
    if (query.excludeJoined) list = list.filter((c) => !joinedIds.has(c.id));
    if (query.interestIds?.length) {
      const ids = query.interestIds;
      list = list.filter((c) => c.interestIds.some((id) => ids.includes(id)));
    }
    if (query.languageCodes?.length) {
      const codes = query.languageCodes;
      list = list.filter((c) => c.languageCodes.some((code) => codes.includes(code)));
    }
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle) ||
          c.purpose.toLowerCase().includes(needle),
      );
    }
    void viewerId;
    return list;
  }

  async getCommunity(communityId: string): Promise<Community | null> {
    await delay(30);
    return this.state.communities.find((c) => c.id === communityId) ?? null;
  }

  async getMemberships(viewerId: string): Promise<CommunityMembership[]> {
    await delay(30);
    void viewerId;
    return [...this.state.memberships.values()];
  }

  async getCommunityMembers(communityId: string): Promise<Profile[]> {
    await delay();
    const ids = this.state.communityMembers.get(communityId) ?? [];
    return ids
      .map((id) => this.state.profiles.get(id))
      .filter((p): p is Profile => Boolean(p) && p!.privacy.showInCommunityLists);
  }

  async requestMembership(communityId: string, note?: string): Promise<CommunityMembership> {
    await delay();
    const viewer = this.requireViewer();
    const community = await this.getCommunity(communityId);
    if (!community) throw new RepositoryError('That community no longer exists.', 'not-found');
    const membership: CommunityMembership = {
      communityId,
      state: community.membershipRequiresApproval ? 'requested' : 'member',
      role: 'member',
      joinedAt: community.membershipRequiresApproval ? null : nowIso(),
    };
    this.state.memberships.set(communityId, membership);
    if (membership.state === 'member') {
      const members = this.state.communityMembers.get(communityId) ?? [];
      if (!members.includes(viewer.id)) {
        this.state.communityMembers.set(communityId, [...members, viewer.id]);
      }
      this.state.communities = this.state.communities.map((c) =>
        c.id === communityId ? { ...c, memberCount: c.memberCount + 1 } : c,
      );
    }
    void note;
    return membership;
  }

  async leaveCommunity(communityId: string): Promise<void> {
    await delay();
    const viewer = this.requireViewer();
    this.state.memberships.delete(communityId);
    const members = this.state.communityMembers.get(communityId) ?? [];
    this.state.communityMembers.set(
      communityId,
      members.filter((id) => id !== viewer.id),
    );
    this.state.communities = this.state.communities.map((c) =>
      c.id === communityId ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c,
    );
  }

  async createCommunity(viewerId: string, input: CreateCommunityInput): Promise<Community> {
    await delay(160);
    this.requireProfile(viewerId);
    const community: Community = {
      id: this.nextId('community'),
      name: input.name.trim(),
      slug: input.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      description: input.description.trim(),
      purpose: input.purpose.trim(),
      interestIds: input.interestIds,
      languageCodes: input.languageCodes,
      joinCode: input.joinCode ?? null,
      membershipRequiresApproval: input.membershipRequiresApproval,
      memberCount: 1,
      coverColour: '#0E3A4C',
      location: null,
      isPrivate: input.isPrivate,
    };
    this.state.communities = [...this.state.communities, community];
    this.state.memberships.set(community.id, {
      communityId: community.id,
      state: 'member',
      role: 'owner',
      joinedAt: nowIso(),
    });
    this.state.communityMembers.set(community.id, [viewerId]);
    return community;
  }

  async resolveJoinCode(code: string): Promise<Community | null> {
    await delay();
    const normalised = code.trim().toUpperCase();
    return this.state.communities.find((c) => c.joinCode?.toUpperCase() === normalised) ?? null;
  }

  async joinByCode(code: string): Promise<Community> {
    const community = await this.resolveJoinCode(code);
    if (!community) {
      throw new RepositoryError('That join code was not recognised.', 'not-found');
    }
    await this.requestMembership(community.id);
    return community;
  }

  async getCommunityMessages(communityId: string): Promise<Message[]> {
    await delay();
    return this.state.communityMessages.get(communityId) ?? [];
  }

  async postCommunityMessage(communityId: string, body: string): Promise<Message> {
    const viewer = this.requireViewer();
    const membership = this.state.memberships.get(communityId);
    if (membership?.state !== 'member') {
      throw new RepositoryError(
        'Join this community to take part in discussions.',
        'not-permitted',
      );
    }
    const message: Message = {
      id: this.nextId('community-message'),
      conversationId: communityId,
      senderId: viewer.id,
      body: body.trim(),
      createdAt: nowIso(),
      state: 'sent',
      translation: null,
      attachments: [],
      voiceNoteSeconds: null,
      waveform: null,
    };
    const existing = this.state.communityMessages.get(communityId) ?? [];
    this.state.communityMessages.set(communityId, [...existing, message]);
    return message;
  }

  // ---- events -----------------------------------------------------------

  async listEvents(viewerId: string, query: EventQuery): Promise<CommunityEvent[]> {
    await delay();
    let list = [...this.state.events];
    if (query.communityIds?.length) {
      const ids = query.communityIds;
      list = list.filter((e) => ids.includes(e.communityId));
    }
    if (query.activityIds?.length) {
      const ids = query.activityIds;
      list = list.filter((e) => e.activityIds.some((id) => ids.includes(id)));
    }
    if (query.languageCodes?.length) {
      const codes = query.languageCodes;
      list = list.filter((e) => e.languageCodes.some((code) => codes.includes(code)));
    }
    if (query.fromDate) {
      const from = query.fromDate;
      list = list.filter((e) => e.startsAt >= from);
    }
    if (query.attendingOnly) {
      list = list.filter((e) => this.state.attending.has(e.id));
    }
    void viewerId;
    return list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getEvent(eventId: string): Promise<CommunityEvent | null> {
    await delay(30);
    return this.state.events.find((e) => e.id === eventId) ?? null;
  }

  async setEventAttendance(eventId: string, attending: boolean): Promise<CommunityEvent> {
    await delay();
    this.requireViewer();
    const event = await this.getEvent(eventId);
    if (!event) throw new RepositoryError('That event no longer exists.', 'not-found');
    const wasAttending = this.state.attending.has(eventId);
    if (attending && !wasAttending) this.state.attending.add(eventId);
    if (!attending && wasAttending) this.state.attending.delete(eventId);
    const delta = attending === wasAttending ? 0 : attending ? 1 : -1;
    const updated: CommunityEvent = {
      ...event,
      attendeeCount: Math.max(0, event.attendeeCount + delta),
    };
    this.state.events = this.state.events.map((e) => (e.id === eventId ? updated : e));
    return updated;
  }

  async createEvent(viewerId: string, input: CreateEventInput): Promise<CommunityEvent> {
    await delay(160);
    this.requireProfile(viewerId);
    const membership = this.state.memberships.get(input.communityId);
    if (membership?.state !== 'member' || membership.role === 'member') {
      throw new RepositoryError('Only community organisers can create events.', 'not-permitted');
    }
    const event: CommunityEvent = {
      id: this.nextId('event'),
      communityId: input.communityId,
      title: input.title.trim(),
      description: input.description.trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      venueName: input.venueName.trim(),
      isPublicVenue: true,
      location: null,
      capacity: input.capacity,
      attendeeCount: 0,
      activityIds: input.activityIds,
      languageCodes: input.languageCodes,
    };
    this.state.events = [...this.state.events, event];
    return event;
  }

  // ---- connections ------------------------------------------------------

  async listConnectionRequests(
    viewerId: string,
  ): Promise<{ incoming: ConnectionRequest[]; outgoing: ConnectionRequest[] }> {
    await delay();
    const pending = this.state.requests.filter((r) => r.status === 'pending');
    return {
      incoming: pending.filter((r) => r.toUserId === viewerId),
      outgoing: pending.filter((r) => r.fromUserId === viewerId),
    };
  }

  async sendConnectionRequest(
    fromUserId: string,
    toUserId: string,
    reason: string | null,
  ): Promise<ConnectionRequest> {
    await delay();
    if (fromUserId === toUserId) {
      throw new RepositoryError('You cannot send a request to yourself.', 'validation');
    }
    const target = this.requireProfile(toUserId);
    if (!target.privacy.allowConnectionRequests) {
      throw new RepositoryError(
        `${target.displayName} is not accepting connection requests right now.`,
        'not-permitted',
      );
    }
    const state = this.connectionStateFor(fromUserId, toUserId);
    if (state === 'blocked') {
      throw new RepositoryError('You cannot connect with this member.', 'not-permitted');
    }
    if (state === 'connected') {
      throw new RepositoryError('You are already connected.', 'conflict');
    }
    if (state !== 'none') {
      throw new RepositoryError('There is already a pending request.', 'conflict');
    }
    // Mirrors the database rate-limit trigger so demo mode behaves like production.
    const pendingOutgoing = this.state.requests.filter(
      (r) => r.status === 'pending' && r.fromUserId === fromUserId,
    ).length;
    if (pendingOutgoing >= 12) {
      throw new RepositoryError(
        'You have reached the limit of pending requests. Wait for replies before sending more.',
        'not-permitted',
      );
    }
    const request: ConnectionRequest = {
      id: this.nextId('request'),
      fromUserId,
      toUserId,
      reason: reason?.trim() ? reason.trim() : null,
      createdAt: nowIso(),
      status: 'pending',
    };
    this.state.requests = [...this.state.requests, request];
    this.state.notifications = [
      {
        id: this.nextId('notification'),
        kind: 'connection-request',
        title: 'New connection request',
        body: `${this.requireProfile(fromUserId).displayName} would like to connect.`,
        createdAt: nowIso(),
        readAt: null,
        target: { screen: 'Connections', params: { tab: 'incoming' } },
      },
      ...this.state.notifications,
    ];
    return request;
  }

  async respondToRequest(
    requestId: string,
    decision: 'accept' | 'decline',
  ): Promise<ConnectionRequest> {
    await delay();
    const viewer = this.requireViewer();
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request) throw new RepositoryError('That request no longer exists.', 'not-found');
    if (request.toUserId !== viewer.id) {
      throw new RepositoryError(
        'Only the recipient can respond to this request.',
        'not-permitted',
      );
    }
    if (request.status !== 'pending') {
      throw new RepositoryError('That request has already been handled.', 'conflict');
    }
    const updated: ConnectionRequest = {
      ...request,
      status: decision === 'accept' ? 'accepted' : 'declined',
    };
    this.state.requests = this.state.requests.map((r) => (r.id === requestId ? updated : r));
    if (decision === 'accept') {
      this.state.connections = [
        ...this.state.connections,
        {
          id: this.nextId('connection'),
          userId: request.fromUserId,
          connectedAt: nowIso(),
          originRequestId: request.id,
        },
      ];
    }
    return updated;
  }

  async cancelRequest(requestId: string): Promise<void> {
    await delay();
    const viewer = this.requireViewer();
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request) throw new RepositoryError('That request no longer exists.', 'not-found');
    if (request.fromUserId !== viewer.id) {
      throw new RepositoryError('You can only cancel requests you sent.', 'not-permitted');
    }
    this.state.requests = this.state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'cancelled' } : r,
    );
  }

  async listConnections(viewerId: string): Promise<Connection[]> {
    await delay();
    void viewerId;
    return [...this.state.connections];
  }

  async removeConnection(connectionId: string): Promise<void> {
    await delay();
    const connection = this.state.connections.find((c) => c.id === connectionId);
    if (!connection) throw new RepositoryError('That connection no longer exists.', 'not-found');
    this.state.connections = this.state.connections.filter((c) => c.id !== connectionId);
    // Removing a connection closes any direct conversation with that member.
    this.state.conversations = this.state.conversations.filter(
      (c) => !(c.kind === 'direct' && c.participantIds.includes(connection.userId)),
    );
  }

  // ---- messaging --------------------------------------------------------

  async listConversations(viewerId: string): Promise<Conversation[]> {
    await delay();
    return this.state.conversations
      .filter((c) => c.participantIds.includes(viewerId))
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    await delay(30);
    return this.state.conversations.find((c) => c.id === conversationId) ?? null;
  }

  async listMessages(conversationId: string, limit = 200): Promise<Message[]> {
    await delay(60);
    return this.state.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit);
  }

  async sendMessage(senderId: string, input: SendMessageInput): Promise<Message> {
    const conversation = await this.getConversation(input.conversationId);
    if (!conversation) {
      throw new RepositoryError('That conversation no longer exists.', 'not-found');
    }
    if (!conversation.participantIds.includes(senderId)) {
      throw new RepositoryError('You are not part of this conversation.', 'not-permitted');
    }
    const body = input.body.trim();
    if (!body && !input.attachments?.length && !input.voiceNoteSeconds) {
      throw new RepositoryError('Write something before sending.', 'validation');
    }
    const other = conversation.participantIds.find((id) => id !== senderId);
    if (conversation.kind === 'direct' && other) {
      if (this.connectionStateFor(senderId, other) !== 'connected') {
        throw new RepositoryError(
          'Direct messages open once you are both connected.',
          'not-permitted',
        );
      }
    }
    const message: Message = {
      id: this.nextId('message'),
      conversationId: input.conversationId,
      senderId,
      body,
      createdAt: nowIso(),
      state: 'sent',
      translation: null,
      attachments: input.attachments ?? [],
      voiceNoteSeconds: input.voiceNoteSeconds ?? null,
      waveform: input.waveform ?? null,
    };
    this.state.messages = [...this.state.messages, message];
    this.state.conversations = this.state.conversations.map((c) =>
      c.id === input.conversationId
        ? { ...c, lastMessageAt: message.createdAt, lastMessagePreview: body || 'Voice note' }
        : c,
    );
    for (const listener of this.messageListeners.get(input.conversationId) ?? []) {
      listener(message);
    }
    // Advance the delivery state so the UI exercises the real state machine.
    setTimeout(() => {
      this.state.messages = this.state.messages.map((m) =>
        m.id === message.id ? { ...m, state: 'delivered' } : m,
      );
    }, 900);
    return message;
  }

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    await delay(20);
    void userId;
    this.state.conversations = this.state.conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c,
    );
    this.state.messages = this.state.messages.map((m) =>
      m.conversationId === conversationId && m.state === 'delivered'
        ? { ...m, state: 'read' }
        : m,
    );
  }

  async openDirectConversation(viewerId: string, otherUserId: string): Promise<Conversation> {
    await delay();
    if (this.connectionStateFor(viewerId, otherUserId) !== 'connected') {
      throw new RepositoryError('Messaging opens once you are both connected.', 'not-permitted');
    }
    const existing = this.state.conversations.find(
      (c) => c.kind === 'direct' && c.participantIds.includes(otherUserId),
    );
    if (existing) return existing;
    const conversation: Conversation = {
      id: this.nextId('conversation'),
      participantIds: [viewerId, otherUserId],
      createdAt: nowIso(),
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: 0,
      kind: 'direct',
    };
    this.state.conversations = [...this.state.conversations, conversation];
    return conversation;
  }

  onMessageInsert(conversationId: string, listener: (message: Message) => void): () => void {
    const set = this.messageListeners.get(conversationId) ?? new Set();
    set.add(listener);
    this.messageListeners.set(conversationId, set);
    return () => {
      set.delete(listener);
    };
  }

  // ---- safety -----------------------------------------------------------

  async listBlockedUsers(viewerId: string): Promise<BlockedUser[]> {
    await delay(30);
    void viewerId;
    return [...this.state.blocked].map((userId) => ({ userId, blockedAt: nowIso() }));
  }

  async blockUser(viewerId: string, userId: string): Promise<void> {
    await delay();
    if (viewerId === userId) {
      throw new RepositoryError('You cannot block yourself.', 'validation');
    }
    this.state.blocked.add(userId);
    this.state.connections = this.state.connections.filter((c) => c.userId !== userId);
    this.state.requests = this.state.requests.map((r) =>
      (r.fromUserId === userId && r.toUserId === viewerId) ||
      (r.toUserId === userId && r.fromUserId === viewerId)
        ? { ...r, status: 'cancelled' }
        : r,
    );
    this.state.conversations = this.state.conversations.filter(
      (c) => !(c.kind === 'direct' && c.participantIds.includes(userId)),
    );
  }

  async unblockUser(_viewerId: string, userId: string): Promise<void> {
    await delay();
    this.state.blocked.delete(userId);
  }

  async submitReport(
    reporterId: string,
    input: {
      subjectUserId?: string;
      subjectMessageId?: string;
      reason: ReportReason;
      detail?: string;
    },
  ): Promise<Report> {
    await delay();
    const report: Report = {
      id: this.nextId('report'),
      reporterId,
      subjectUserId: input.subjectUserId ?? null,
      subjectMessageId: input.subjectMessageId ?? null,
      reason: input.reason,
      detail: input.detail?.trim() ? input.detail.trim() : null,
      createdAt: nowIso(),
      status: 'open',
    };
    this.state.reports = [...this.state.reports, report];
    return report;
  }

  // ---- notifications ----------------------------------------------------

  async listNotifications(viewerId: string): Promise<AppNotification[]> {
    await delay(30);
    void viewerId;
    return [...this.state.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await delay(20);
    this.state.notifications = this.state.notifications.map((n) =>
      n.id === notificationId ? { ...n, readAt: nowIso() } : n,
    );
  }

  async markAllNotificationsRead(viewerId: string): Promise<void> {
    await delay(30);
    void viewerId;
    this.state.notifications = this.state.notifications.map((n) =>
      n.readAt ? n : { ...n, readAt: nowIso() },
    );
  }
}
