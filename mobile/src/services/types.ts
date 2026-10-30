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
} from '../types/domain';
import type { DiscoverFilters } from '../features/matching/engine';

/**
 * Repository contract.
 *
 * Two implementations satisfy it: `demo/` (in-memory, used when Supabase is not
 * configured) and `supabase/` (real auth, Postgres, Realtime and Storage). The
 * UI depends only on this interface, so no screen needs to know which one is
 * active.
 */

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResult {
  user: SessionUser | null;
  /** True when sign-up succeeded but a confirmation step is still required. */
  confirmationRequired: boolean;
}

export interface ProfileUpdate {
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  /**
   * Object key inside the private avatars bucket. Screens never set this to a
   * URL: the URL is signed on read.
   */
  avatarPath?: string | null;
  interests?: string[];
  skills?: string[];
  learningSkills?: string[];
  languages?: string[];
  goals?: string[];
  preferredActivities?: string[];
  location?: Profile['location'];
  privacy?: Partial<Profile['privacy']>;
  notifications?: Partial<Profile['notifications']>;
  onboardingCompleted?: boolean;
}

export interface CommunityQuery {
  search?: string;
  interestIds?: string[];
  languageCodes?: string[];
  /** Only communities the viewer has already joined. */
  joinedOnly?: boolean;
  /** Only communities the viewer has not joined. */
  excludeJoined?: boolean;
}

export interface EventQuery {
  communityIds?: string[];
  fromDate?: string;
  activityIds?: string[];
  languageCodes?: string[];
  /** Only events the viewer has indicated they will attend. */
  attendingOnly?: boolean;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  /** Seconds, present only for voice notes. */
  voiceNoteSeconds?: number;
  /** Peak amplitude per bar, 0-100. Only meaningful with `voiceNoteSeconds`. */
  waveform?: number[];
  attachments?: Message['attachments'];
}

export interface CreateCommunityInput {
  name: string;
  purpose: string;
  description: string;
  interestIds: string[];
  languageCodes: string[];
  membershipRequiresApproval: boolean;
  isPrivate: boolean;
  joinCode?: string | null;
}

export interface CreateEventInput {
  communityId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  activityIds: string[];
  languageCodes: string[];
  capacity: number | null;
}

/** A member returned by a nearby search, with a rounded distance. */
export interface NearbyPerson {
  profile: Profile;
  /** Whole kilometres, measured from a coarse grid. Never more precise. */
  distanceKm: number;
}

/** A community returned by a nearby search. */
export interface NearbyCommunity {
  community: Community;
  distanceKm: number;
}

/** Where to search from, and how far. */
export interface NearbyQuery {
  center: { latitude: number; longitude: number } | null;
  radiusKm: number;
}

/** A place filter for global discovery. Both fields optional: null means anywhere. */
export interface PlaceQuery {
  city?: string | null;
  countryCode?: string | null;
}

export interface Repository {
  readonly kind: 'demo' | 'supabase';

  // ---- auth ----
  getSession(): Promise<SessionUser | null>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;
  onAuthStateChange(listener: (user: SessionUser | null) => void): () => void;

  // ---- profiles ----
  getProfile(userId: string): Promise<Profile | null>;
  listProfiles(options?: { excludeIds?: string[] }): Promise<Profile[]>;
  updateProfile(userId: string, update: ProfileUpdate): Promise<Profile>;
  /**
   * Upload a profile photo into the caller's private folder.
   *
   * Resolves to the object path, not a URL. The bucket is private, so a URL
   * would be useless without a signature anyway.
   */
  uploadAvatar(userId: string, localUri: string, mimeType: string): Promise<string>;
  /** Remove the caller's stored photo. */
  deleteAvatar(userId: string): Promise<void>;
  /**
   * Exchange stored photo paths for short-lived signed URLs.
   *
   * Returns a map from profile id to URL, omitting profiles the caller is not
   * permitted to see. Storage refuses to sign an object the caller cannot read,
   * so an omitted id means denied rather than merely absent.
   */
  resolveAvatarUrls(profileIds: string[]): Promise<Record<string, string>>;

  // ---- matching ----
  getMatches(viewerId: string, filters: DiscoverFilters): Promise<MatchResult[]>;

  // ---- location discovery ----
  /**
   * Members who have opted into nearby discovery within the radius.
   *
   * Resolves to an empty array when nobody eligible is nearby, which the
   * interface must present as an honest empty state rather than as an error.
   */
  listNearbyPeople(viewerId: string, query: NearbyQuery): Promise<NearbyPerson[]>;
  /** Communities with a recorded area within the radius. */
  listNearbyCommunities(viewerId: string, query: NearbyQuery): Promise<NearbyCommunity[]>;
  /** Discoverable members who recorded the given city and/or country. */
  listPeopleInPlace(viewerId: string, query: PlaceQuery): Promise<Profile[]>;

  // ---- communities ----
  listCommunities(viewerId: string, query: CommunityQuery): Promise<Community[]>;
  getCommunity(communityId: string): Promise<Community | null>;
  getMemberships(viewerId: string): Promise<CommunityMembership[]>;
  getCommunityMembers(communityId: string): Promise<Profile[]>;
  requestMembership(communityId: string, note?: string): Promise<CommunityMembership>;
  leaveCommunity(communityId: string): Promise<void>;
  createCommunity(viewerId: string, input: CreateCommunityInput): Promise<Community>;
  resolveJoinCode(code: string): Promise<Community | null>;
  joinByCode(code: string): Promise<Community>;
  getCommunityMessages(communityId: string): Promise<Message[]>;
  postCommunityMessage(communityId: string, body: string): Promise<Message>;

  // ---- events ----
  listEvents(viewerId: string, query: EventQuery): Promise<CommunityEvent[]>;
  getEvent(eventId: string): Promise<CommunityEvent | null>;
  setEventAttendance(eventId: string, attending: boolean): Promise<CommunityEvent>;
  createEvent(viewerId: string, input: CreateEventInput): Promise<CommunityEvent>;

  // ---- connections ----
  listConnectionRequests(viewerId: string): Promise<{
    incoming: ConnectionRequest[];
    outgoing: ConnectionRequest[];
  }>;
  sendConnectionRequest(
    fromUserId: string,
    toUserId: string,
    reason: string | null,
  ): Promise<ConnectionRequest>;
  respondToRequest(
    requestId: string,
    decision: 'accept' | 'decline',
  ): Promise<ConnectionRequest>;
  cancelRequest(requestId: string): Promise<void>;
  listConnections(viewerId: string): Promise<Connection[]>;
  removeConnection(connectionId: string): Promise<void>;

  // ---- messaging ----
  listConversations(viewerId: string): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  listMessages(conversationId: string, limit?: number): Promise<Message[]>;
  sendMessage(senderId: string, input: SendMessageInput): Promise<Message>;
  markConversationRead(conversationId: string, userId: string): Promise<void>;
  /** Opens (or reuses) a direct conversation. Requires an existing connection. */
  openDirectConversation(viewerId: string, otherUserId: string): Promise<Conversation>;
  onMessageInsert(conversationId: string, listener: (message: Message) => void): () => void;

  // ---- safety ----
  listBlockedUsers(viewerId: string): Promise<BlockedUser[]>;
  blockUser(viewerId: string, userId: string): Promise<void>;
  unblockUser(viewerId: string, userId: string): Promise<void>;
  submitReport(
    reporterId: string,
    input: { subjectUserId?: string; subjectMessageId?: string; reason: ReportReason; detail?: string },
  ): Promise<Report>;

  // ---- notifications ----
  listNotifications(viewerId: string): Promise<AppNotification[]>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(viewerId: string): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not-authenticated'
      | 'not-permitted'
      | 'not-found'
      | 'conflict'
      | 'validation'
      | 'network'
      | 'unknown' = 'unknown',
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
