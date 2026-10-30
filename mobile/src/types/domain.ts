/** Domain model. Mirrors the Supabase schema in `supabase/migrations`. */

export type Visibility = 'community' | 'discoverable' | 'private';

/**
 * Who may see a member's profile photo.
 *
 * Distinct from `Visibility`, which governs whether the profile is discoverable
 * at all. Every level here is enforced by the storage policy in
 * `20260101001100_photo_privacy.sql`, so the app only offers options the
 * database can actually apply.
 */
export type PhotoVisibility = 'public' | 'community' | 'connections' | 'private';

export const PHOTO_VISIBILITY_OPTIONS: Array<{
  id: PhotoVisibility;
  label: string;
  hint: string;
}> = [
  {
    id: 'public',
    label: 'Any signed-in member',
    hint: 'Anyone with a Converge account who opens your profile.',
  },
  {
    id: 'community',
    label: 'Members of my communities',
    hint: 'People who share at least one community with you.',
  },
  {
    id: 'connections',
    label: 'My connections',
    hint: 'Only people whose connection request you have accepted.',
  },
  { id: 'private', label: 'Only me', hint: 'Nobody else can load your photo.' },
];
export type ConnectionState = 'none' | 'pending-outgoing' | 'pending-incoming' | 'connected' | 'blocked';
export type MessageDeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type CommunityRole = 'member' | 'organiser' | 'owner';
export type MembershipState = 'none' | 'requested' | 'invited' | 'member';
export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'impersonation'
  | 'inappropriate-content'
  | 'safety-concern'
  | 'other';

/** Reason catalogue shared by the report UI and the database check constraint. */
export const REPORT_REASONS: Array<{ id: ReportReason; label: string; hint: string }> = [
  {
    id: 'harassment',
    label: 'Harassment',
    hint: 'Targeted, repeated or abusive contact.',
  },
  { id: 'spam', label: 'Spam or scam', hint: 'Advertising, phishing or a fraudulent request.' },
  {
    id: 'impersonation',
    label: 'Impersonation',
    hint: 'Pretending to be someone else, including a real organisation.',
  },
  {
    id: 'inappropriate-content',
    label: 'Inappropriate content',
    hint: 'Content that is sexual, violent or otherwise unsuitable for this community.',
  },
  {
    id: 'safety-concern',
    label: 'Safety concern',
    hint: 'Behaviour that made you feel unsafe, including during an in-person activity.',
  },
  { id: 'other', label: 'Something else', hint: 'Describe it below so moderators can assess it.' },
];

export interface ApproximateLocation {
  /** Snapped to a coarse grid; never an exact device coordinate. */
  latitude: number;
  longitude: number;
  /** Free-text area label chosen by the user, e.g. "Northside". */
  areaLabel?: string;
  /** City from reverse geocoding, used for place search. */
  city?: string;
  /** ISO 3166-1 alpha-2 country code from reverse geocoding. */
  countryCode?: string;
}

export interface PrivacySettings {
  visibility: Visibility;
  /** Share a coarse area for proximity matching. Off by default. */
  shareApproximateLocation: boolean;
  /** Allow other members to send a connection request. */
  allowConnectionRequests: boolean;
  /** Show the member in community member lists. */
  showInCommunityLists: boolean;
  /** Who may load the profile photo. Enforced by the storage policy. */
  photoVisibility: PhotoVisibility;
  /**
   * Whether the member appears in the Nearby Network.
   *
   * Separate from `shareApproximateLocation`: that one says "use my area to rank
   * others for me", this one says "list me for others". A member can reasonably
   * want the first without the second, so the two are not combined.
   */
  nearbyDiscoveryEnabled: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  visibility: 'community',
  shareApproximateLocation: false,
  allowConnectionRequests: true,
  showInCommunityLists: true,
  photoVisibility: 'community',
  nearbyDiscoveryEnabled: false,
};

export interface NotificationSettings {
  connectionRequests: boolean;
  messages: boolean;
  communityActivity: boolean;
  eventReminders: boolean;
  productUpdates: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  connectionRequests: true,
  messages: true,
  communityActivity: true,
  eventReminders: true,
  productUpdates: false,
};

export interface Profile {
  id: string;
  displayName: string;
  /**
   * A displayable URL for the profile photo, or null.
   *
   * Photos live in a private bucket, so this is a short-lived signed URL
   * obtained from `Repository.resolveAvatarUrl`, never a stored public URL.
   * Callers that hold a `Profile` from a list therefore hold a URL that expires;
   * screens that must show a photo for longer re-resolve it.
   */
  avatarUrl: string | null;
  /** Optional one-line introduction. */
  headline: string | null;
  bio: string | null;
  interests: string[];
  skills: string[];
  /** Skills the member wants to develop rather than offer. */
  learningSkills: string[];
  languages: string[];
  goals: string[];
  preferredActivities: string[];
  location: ApproximateLocation | null;
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** One-line purpose statement shown on cards. */
  purpose: string;
  interestIds: string[];
  languageCodes: string[];
  /** Communities with a join code are joined by QR or code entry. */
  joinCode: string | null;
  membershipRequiresApproval: boolean;
  memberCount: number;
  coverColour: string;
  location: ApproximateLocation | null;
  isPrivate: boolean;
}

export interface CommunityMembership {
  communityId: string;
  state: MembershipState;
  role: CommunityRole;
  joinedAt: string | null;
}

export interface CommunityEvent {
  id: string;
  communityId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  /** Public venues only. Private residences are rejected at write time. */
  isPublicVenue: boolean;
  location: ApproximateLocation | null;
  capacity: number | null;
  attendeeCount: number;
  activityIds: string[];
  languageCodes: string[];
}

export interface MatchReason {
  /** Stable key so the UI can pick an icon without parsing text. */
  kind:
    | 'shared-interest'
    | 'complementary-skill'
    | 'shared-goal'
    | 'language-compatibility'
    | 'shared-activity'
    | 'shared-community'
    | 'proximity';
  /** Human-readable explanation shown in the UI. */
  detail: string;
}

export interface MatchResult {
  profile: Profile;
  /** Weighted score. Never presented to users as a percentage. */
  score: number;
  reasons: MatchReason[];
  sharedInterests: string[];
  sharedGoals: string[];
  sharedActivities: string[];
  sharedCommunities: string[];
  sharedLanguages: string[];
}

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  /** Optional context. Requests without a reason are still allowed. */
  reason: string | null;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

export interface Connection {
  id: string;
  userId: string;
  connectedAt: string;
  /** Matched request that created the connection, when there was one. */
  originRequestId: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  state: MessageDeliveryState;
  /** Translation of `body` into the reader's language, when produced. */
  translation: MessageTranslation | null;
  attachments: MessageAttachment[];
  /** Voice notes are stored as audio attachments with a duration. */
  voiceNoteSeconds: number | null;
  /**
   * Peak amplitude per bar, 0-100, for a voice note.
   *
   * Produced from the recording itself by the native audio module (see
   * `services/native/audio.ts`). Null when extraction was unavailable, in which
   * case the UI shows the duration alone rather than a flat line.
   */
  waveform: number[] | null;
}

export interface MessageTranslation {
  targetLanguage: string;
  text: string;
  provider: string;
  /** False when the message was already in the target language. */
  wasTranslated: boolean;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  kind: 'image' | 'audio' | 'file';
  url: string;
  mimeType: string;
  byteSize: number;
  /** Populated for audio attachments. */
  durationSeconds?: number;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  /** Conversation titles are derived, never stored. */
  kind: 'direct' | 'group';
}

export interface Report {
  id: string;
  reporterId: string;
  subjectUserId: string | null;
  subjectMessageId: string | null;
  reason: ReportReason;
  detail: string | null;
  createdAt: string;
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
}

export interface BlockedUser {
  userId: string;
  blockedAt: string;
}

export interface AppNotification {
  id: string;
  kind: 'connection-request' | 'connection-accepted' | 'message' | 'community' | 'event';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** Deep-link payload for the target screen. */
  target: { screen: string; params?: Record<string, string> } | null;
}

/** The signed-in member: auth identity plus profile. */
export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}
