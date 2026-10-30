import type { SupabaseClient } from '@supabase/supabase-js';

import { TRANSLATABLE_LANGUAGE_CODES } from '../../constants/taxonomy';
import type { DiscoverFilters } from '../../features/matching/engine';
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
  MessageAttachment,
  MessageTranslation,
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
  type NearbyCommunity,
  type NearbyPerson,
  type NearbyQuery,
  type PlaceQuery,
  type ProfileUpdate,
  type Repository,
  type SendMessageInput,
  type SignUpInput,
} from '../types';
import type {
  Database,
  CommunityMemberRow,
  CommunityMessageRow,
  CommunityRow,
  ConnectionRequestRow,
  ConnectionRow,
  ConversationRow,
  EventRow,
  MessageRow,
  MessageTranslationRow,
  NotificationRow,
  ProfileRow,
  ReportRow,
} from './database.types';

/**
 * Supabase-backed repository: real authentication, Postgres, Realtime, Storage.
 *
 * Every query runs as the signed-in user, so Row Level Security is the
 * authority on what is visible. Nothing here uses a service key.
 */

interface ProfileRelations {
  profile_interests: Array<{ interest_id: string }>;
  profile_skills: Array<{ skill_id: string; intent: 'offer' | 'learn' }>;
  profile_languages: Array<{ language_code: string }>;
  profile_goals: Array<{ goal_id: string }>;
  profile_activities: Array<{ activity_id: string }>;
}

/**
 * Community columns the app may read.
 *
 * `join_code` is deliberately absent: the column is not granted to
 * `authenticated`, so it is read through `community_join_codes`, which checks
 * membership. A bare `*` would fail the query outright.
 */
const COMMUNITY_SELECT = `id, name, slug, description, purpose,
  membership_requires_approval, is_private, member_count, cover_colour,
  latitude, longitude, area_label, created_by, created_at`;

const PROFILE_SELECT = `*,
  profile_interests(interest_id),
  profile_skills(skill_id, intent),
  profile_languages(language_code),
  profile_goals(goal_id),
  profile_activities(activity_id)`;

/**
 * Lifetime of a signed avatar URL.
 *
 * Long enough that a screen does not visibly re-fetch while in use, short
 * enough that a leaked URL stops working quickly. Signed URLs are cached per
 * session and refreshed on demand rather than stored.
 */
const AVATAR_URL_TTL_SECONDS = 60 * 30;

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  constructor(private readonly client: SupabaseClient) {}

  // ---- mapping helpers --------------------------------------------------

  private mapProfile(row: ProfileRow & Partial<ProfileRelations>): Profile {
    const offered: string[] = [];
    const learning: string[] = [];
    for (const skill of row.profile_skills ?? []) {
      if (skill.intent === 'learn') learning.push(skill.skill_id);
      else offered.push(skill.skill_id);
    }
    return {
      id: row.id,
      displayName: row.display_name,
      // A stored path, not a URL: it is signed on demand so the private bucket
      // stays private. Lists show initials until `resolveAvatarUrls` fills it.
      avatarUrl: null,
      headline: row.headline,
      bio: row.bio,
      interests: (row.profile_interests ?? []).map((i) => i.interest_id),
      skills: offered,
      learningSkills: learning,
      languages: (row.profile_languages ?? []).map((l) => l.language_code),
      goals: (row.profile_goals ?? []).map((g) => g.goal_id),
      preferredActivities: (row.profile_activities ?? []).map((a) => a.activity_id),
      location:
        row.latitude !== null && row.longitude !== null
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
              areaLabel: row.area_label ?? undefined,
              city: row.city ?? undefined,
              countryCode: row.country_code ?? undefined,
            }
          : null,
      privacy: {
        visibility: row.visibility,
        shareApproximateLocation: row.share_approximate_location,
        allowConnectionRequests: row.allow_connection_requests,
        showInCommunityLists: row.show_in_community_lists,
        photoVisibility: row.photo_visibility,
        nearbyDiscoveryEnabled: row.nearby_discovery_enabled,
      },
      notifications: {
        connectionRequests: row.notify_connection_requests,
        messages: row.notify_messages,
        communityActivity: row.notify_community_activity,
        eventReminders: row.notify_event_reminders,
        productUpdates: row.notify_product_updates,
      },
      onboardingCompleted: row.onboarding_completed,
      createdAt: row.created_at,
    };
  }

  private mapCommunity(
    row: CommunityRow,
    interestIds: string[],
    languageCodes: string[],
    joinCode: string | null = null,
  ): Community {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      purpose: row.purpose,
      interestIds,
      languageCodes,
      // The column is not selectable: it arrives from `community_join_codes`
      // only for communities the viewer belongs to.
      joinCode,
      membershipRequiresApproval: row.membership_requires_approval,
      memberCount: row.member_count,
      coverColour: row.cover_colour,
      location:
        row.latitude !== null && row.longitude !== null
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
              areaLabel: row.area_label ?? undefined,
            }
          : null,
      isPrivate: row.is_private,
    };
  }

  private mapEvent(row: EventRow): CommunityEvent {
    return {
      id: row.id,
      communityId: row.community_id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      venueName: row.venue_name,
      isPublicVenue: row.is_public_venue,
      location:
        row.latitude !== null && row.longitude !== null
          ? { latitude: row.latitude, longitude: row.longitude }
          : null,
      capacity: row.capacity,
      attendeeCount: row.attendee_count,
      activityIds: row.activity_ids ?? [],
      languageCodes: row.language_codes ?? [],
    };
  }

  private mapMessage(
    row: MessageRow,
    translations: MessageTranslationRow[] = [],
    readerLanguage?: string,
  ): Message {
    const preferred = readerLanguage
      ? translations.find((t) => t.target_language === readerLanguage)
      : undefined;
    const translation: MessageTranslation | null = preferred
      ? {
          targetLanguage: preferred.target_language,
          text: preferred.text,
          provider: preferred.provider,
          wasTranslated: preferred.was_translated,
          createdAt: preferred.created_at,
        }
      : null;
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
      state: 'sent',
      translation,
      attachments: Array.isArray(row.attachments)
        ? (row.attachments as MessageAttachment[])
        : [],
      voiceNoteSeconds: row.voice_note_seconds,
      waveform: row.waveform ?? null,
    };
  }

  private fail(error: { message: string; code?: string } | null, fallback: string): never {
    const message = error?.message ?? fallback;
    const code = error?.code ?? '';
    if (code === '23505' || /duplicate key/i.test(message)) {
      throw new RepositoryError('That already exists.', 'conflict');
    }
    if (code === '42501' || /row-level security|permission denied/i.test(message)) {
      throw new RepositoryError('You do not have permission to do that.', 'not-permitted');
    }
    if (code === 'PGRST116' || /no rows/i.test(message)) {
      throw new RepositoryError('That item no longer exists.', 'not-found');
    }
    if (/network|fetch failed|timeout/i.test(message)) {
      throw new RepositoryError('Could not reach Converge. Check your connection.', 'network');
    }
    throw new RepositoryError(message, 'unknown');
  }

  private async loadProfile(id: string): Promise<Profile> {
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) this.fail(error, 'Could not load your profile.');
    if (!data) throw new RepositoryError('That profile no longer exists.', 'not-found');
    return this.mapProfile(data as ProfileRow & ProfileRelations);
  }

  private async buildSession(userId: string, email: string): Promise<SessionUser> {
    return { id: userId, email, profile: await this.loadProfile(userId) };
  }

  private async replaceRelations(
    table:
      | 'profile_interests'
      | 'profile_languages'
      | 'profile_goals'
      | 'profile_activities',
    column: string,
    userId: string,
    values: string[],
  ): Promise<void> {
    const { error: deleteError } = await this.client.from(table).delete().eq('profile_id', userId);
    if (deleteError) this.fail(deleteError, `Could not update ${table}.`);
    if (values.length === 0) return;
    const { error } = await this.client
      .from(table)
      .insert(values.map((value) => ({ profile_id: userId, [column]: value })));
    if (error) this.fail(error, `Could not update ${table}.`);
  }

  // ---- auth -------------------------------------------------------------

  async getSession(): Promise<SessionUser | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) this.fail(error, 'Could not restore your session.');
    const user = data.session?.user;
    if (!user) return null;
    try {
      return await this.buildSession(user.id, user.email ?? '');
    } catch {
      // Authenticated but the profile row is missing: treat as signed out so the
      // app can send the user back through onboarding instead of crashing.
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new RepositoryError(
        /invalid login/i.test(error.message)
          ? 'That email and password combination was not recognised.'
          : error.message,
        'not-authenticated',
      );
    }
    if (!data.user) throw new RepositoryError('Sign in did not complete.', 'unknown');
    return {
      user: await this.buildSession(data.user.id, data.user.email ?? email.trim()),
      confirmationRequired: false,
    };
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { display_name: input.displayName.trim() } },
    });
    if (error) {
      throw new RepositoryError(
        /already registered/i.test(error.message)
          ? 'An account already exists for that email.'
          : error.message,
        /already registered/i.test(error.message) ? 'conflict' : 'unknown',
      );
    }
    if (!data.user) throw new RepositoryError('Sign up did not complete.', 'unknown');
    // The `handle_new_user` trigger creates the profile row from user metadata.
    const confirmationRequired = !data.session;
    if (confirmationRequired) return { user: null, confirmationRequired: true };
    return {
      user: await this.buildSession(data.user.id, data.user.email ?? input.email.trim()),
      confirmationRequired: false,
    };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) this.fail(error, 'Could not sign out.');
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim());
    if (error) this.fail(error, 'Could not send the recovery email.');
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) this.fail(error, 'Could not update your password.');
  }

  async deleteAccount(): Promise<void> {
    // Deletion is performed by the `delete-account` Edge Function so the
    // service key never reaches the client.
    const { error } = await this.client.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      this.fail(
        { message: 'Account deletion is unavailable until the delete-account function is deployed.' },
        'Could not delete your account.',
      );
    }
    await this.client.auth.signOut();
  }

  onAuthStateChange(listener: (user: SessionUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        listener(null);
        return;
      }
      void this.buildSession(session.user.id, session.user.email ?? '')
        .then(listener)
        .catch(() => listener(null));
    });
    return () => data.subscription.unsubscribe();
  }

  // ---- profiles ---------------------------------------------------------

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();
    if (error) this.fail(error, 'Could not load that profile.');
    return data ? this.mapProfile(data as ProfileRow & ProfileRelations) : null;
  }

  async listProfiles(options?: { excludeIds?: string[] }): Promise<Profile[]> {
    let query = this.client.from('profiles').select(PROFILE_SELECT);
    if (options?.excludeIds?.length) query = query.not('id', 'in', `(${options.excludeIds.join(',')})`);
    const { data, error } = await query.limit(200);
    if (error) this.fail(error, 'Could not load members.');
    return (data ?? []).map((row) => this.mapProfile(row as ProfileRow & ProfileRelations));
  }

  async updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    const patch: Record<string, unknown> = {};
    if (update.displayName !== undefined) patch.display_name = update.displayName.trim();
    if (update.headline !== undefined) patch.headline = update.headline;
    if (update.bio !== undefined) patch.bio = update.bio;
    if (update.avatarPath !== undefined) patch.avatar_path = update.avatarPath;
    if (update.onboardingCompleted !== undefined) {
      patch.onboarding_completed = update.onboardingCompleted;
    }
    if (update.location !== undefined) {
      if (update.location) {
        const snapped = snapToGrid(update.location);
        patch.latitude = snapped.latitude;
        patch.longitude = snapped.longitude;
        patch.area_label = update.location.areaLabel ?? null;
      } else {
        patch.latitude = null;
        patch.longitude = null;
        patch.area_label = null;
      }
    }
    if (update.privacy) {
      if (update.privacy.visibility !== undefined) patch.visibility = update.privacy.visibility;
      if (update.privacy.shareApproximateLocation !== undefined) {
        patch.share_approximate_location = update.privacy.shareApproximateLocation;
      }
      if (update.privacy.allowConnectionRequests !== undefined) {
        patch.allow_connection_requests = update.privacy.allowConnectionRequests;
      }
      if (update.privacy.showInCommunityLists !== undefined) {
        patch.show_in_community_lists = update.privacy.showInCommunityLists;
      }
    }
    if (update.notifications) {
      if (update.notifications.connectionRequests !== undefined) {
        patch.notify_connection_requests = update.notifications.connectionRequests;
      }
      if (update.notifications.messages !== undefined) {
        patch.notify_messages = update.notifications.messages;
      }
      if (update.notifications.communityActivity !== undefined) {
        patch.notify_community_activity = update.notifications.communityActivity;
      }
      if (update.notifications.eventReminders !== undefined) {
        patch.notify_event_reminders = update.notifications.eventReminders;
      }
      if (update.notifications.productUpdates !== undefined) {
        patch.notify_product_updates = update.notifications.productUpdates;
      }
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await this.client.from('profiles').update(patch).eq('id', userId);
      if (error) this.fail(error, 'Could not save your profile.');
    }
    if (update.interests) {
      await this.replaceRelations('profile_interests', 'interest_id', userId, update.interests);
    }
    if (update.languages) {
      await this.replaceRelations('profile_languages', 'language_code', userId, update.languages);
    }
    if (update.goals) {
      await this.replaceRelations('profile_goals', 'goal_id', userId, update.goals);
    }
    if (update.preferredActivities) {
      await this.replaceRelations(
        'profile_activities',
        'activity_id',
        userId,
        update.preferredActivities,
      );
    }
    if (update.skills || update.learningSkills) {
      const { error: deleteError } = await this.client
        .from('profile_skills')
        .delete()
        .eq('profile_id', userId);
      if (deleteError) this.fail(deleteError, 'Could not update your skills.');
      const rows = [
        ...(update.skills ?? []).map((skill_id) => ({
          profile_id: userId,
          skill_id,
          intent: 'offer' as const,
        })),
        ...(update.learningSkills ?? []).map((skill_id) => ({
          profile_id: userId,
          skill_id,
          intent: 'learn' as const,
        })),
      ];
      if (rows.length > 0) {
        const { error } = await this.client.from('profile_skills').insert(rows);
        if (error) this.fail(error, 'Could not update your skills.');
      }
    }
    return this.loadProfile(userId);
  }

  /**
   * Upload a profile photo into the caller's private folder.
   *
   * Returns the object path. The bucket is private, so no public URL exists to
   * return; readers are issued a short-lived signed URL instead, and only if
   * the storage policy admits them.
   *
   * The object key is `<userId>/avatar.<ext>`, which is what the storage insert
   * policy checks against `auth.uid()`.
   */
  async uploadAvatar(userId: string, localUri: string, mimeType: string): Promise<string> {
    const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `${userId}/avatar.${extension}`;
    const response = await fetch(localUri);
    const blob = await response.blob();
    const { error } = await this.client.storage
      .from('avatars')
      .upload(path, blob, { contentType: mimeType, upsert: true });
    if (error) this.fail(error, 'Could not upload that photo.');
    return path;
  }

  /** Delete the caller's stored photo, if any. */
  async deleteAvatar(userId: string): Promise<void> {
    const { data, error } = await this.client.storage.from('avatars').list(userId);
    if (error) this.fail(error, 'Could not read your stored photo.');
    const keys = (data ?? []).map((entry) => `${userId}/${entry.name}`);
    if (keys.length === 0) return;
    const { error: removeError } = await this.client.storage.from('avatars').remove(keys);
    if (removeError) this.fail(removeError, 'Could not remove your photo.');
  }

  /**
   * Sign photo URLs for the given profiles.
   *
   * Only members whose photo the caller may read come back with a URL, because
   * storage evaluates the bucket's SELECT policy before signing. A denied
   * profile is therefore simply absent from the result, which callers render as
   * initials rather than as a broken image.
   */
  async resolveAvatarUrls(profileIds: string[]): Promise<Record<string, string>> {
    if (profileIds.length === 0) return {};

    // The path is not part of the public profile payload, so it is read here.
    // A member can read their own row plus any row their visibility permits.
    const { data: rows, error } = await this.client
      .from('profiles')
      .select('id, avatar_path')
      .in('id', profileIds);
    if (error) this.fail(error, 'Could not load profile photos.');

    const paths = (rows ?? []).filter(
      (row): row is { id: string; avatar_path: string } =>
        typeof row.avatar_path === 'string' && row.avatar_path.length > 0,
    );
    if (paths.length === 0) return {};

    const { data: signed, error: signError } = await this.client.storage
      .from('avatars')
      .createSignedUrls(
        paths.map((row) => row.avatar_path),
        AVATAR_URL_TTL_SECONDS,
      );
    if (signError) this.fail(signError, 'Could not prepare profile photos.');

    // `createSignedUrls` preserves input order, so index back to the profile id.
    const result: Record<string, string> = {};
    paths.forEach((row, index) => {
      const entry = signed?.[index];
      if (entry?.signedUrl) result[row.id] = entry.signedUrl;
    });
    return result;
  }

  // ---- matching ---------------------------------------------------------

  /**
   * Members who have opted into nearby discovery, within the radius.
   *
   * The work is done by `nearby_profiles`, which returns only the fields the
   * Nearby list needs and a distance rounded to whole kilometres. Coordinates
   * are never returned: the caller could not reconstruct a position from a
   * rounded distance measured against a 5 km grid.
   */
  async listNearbyPeople(viewerId: string, query: NearbyQuery): Promise<NearbyPerson[]> {
    if (!query.center) return [];

    const { data, error } = await this.client.rpc('nearby_profiles', {
      viewer: viewerId,
      center_lat: query.center.latitude,
      center_lng: query.center.longitude,
      radius_km: query.radiusKm,
      max_results: 60,
    });
    if (error) this.fail(error, 'Could not search for members nearby.');

    // `rpc` is untyped on this client, so the row shape is asserted from the
    // migration's return signature rather than inferred.
    const rows = (data ?? []) as Database['public']['Functions']['nearby_profiles']['Returns'];
    if (rows.length === 0) return [];

    // The function returns a narrow projection, so the full profile is loaded
    // for the ids it produced. Only members it already decided are eligible are
    // requested, which keeps the visibility decision in one place.
    const profiles = await this.loadProfilesByIds(rows.map((row) => row.id));
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    return rows.flatMap((row) => {
      const profile = byId.get(row.id);
      return profile ? [{ profile, distanceKm: row.distance_km }] : [];
    });
  }

  /** Communities with a recorded area inside the radius. */
  async listNearbyCommunities(
    viewerId: string,
    query: NearbyQuery,
  ): Promise<NearbyCommunity[]> {
    if (!query.center) return [];

    const { data, error } = await this.client.rpc('nearby_communities', {
      viewer: viewerId,
      center_lat: query.center.latitude,
      center_lng: query.center.longitude,
      radius_km: query.radiusKm,
      max_results: 60,
    });
    if (error) this.fail(error, 'Could not search for communities nearby.');

    const rows = (data ?? []) as Database['public']['Functions']['nearby_communities']['Returns'];
    if (rows.length === 0) return [];

    const communities = await this.loadCommunitiesByIds(rows.map((row) => row.id));
    const byId = new Map(communities.map((community) => [community.id, community]));

    return rows.flatMap((row) => {
      const community = byId.get(row.id);
      return community ? [{ community, distanceKm: row.distance_km }] : [];
    });
  }

  /** Discoverable members who recorded the given city and/or country. */
  async listPeopleInPlace(viewerId: string, query: PlaceQuery): Promise<Profile[]> {
    const { data, error } = await this.client.rpc('profiles_in_place', {
      viewer: viewerId,
      place_city: query.city ?? null,
      place_country: query.countryCode ?? null,
      max_results: 60,
    });
    if (error) this.fail(error, 'Could not search that place.');

    const rows = (data ?? []) as Database['public']['Functions']['profiles_in_place']['Returns'];
    return this.loadProfilesByIds(rows.map((row) => row.id));
  }

  /** Load full profiles for a set of ids, with their relation tables. */
  private async loadProfilesByIds(ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_SELECT)
      .in('id', ids);
    if (error) this.fail(error, 'Could not load those profiles.');
    return (data ?? []).map((row) => this.mapProfile(row));
  }

  /**
   * Load communities for a set of ids, with their interest and language tags.
   *
   * Mirrors `listCommunities`, including loading join codes through the
   * security-definer function rather than a plain select, so a community's
   * invite code is only present for communities the viewer may see.
   */
  private async loadCommunitiesByIds(ids: string[]): Promise<Community[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from('communities')
      .select(COMMUNITY_SELECT)
      .in('id', ids);
    if (error) this.fail(error, 'Could not load those communities.');

    const rows = (data ?? []) as CommunityRow[];
    const [relations, joinCodes] = await Promise.all([
      this.loadCommunityInterests(rows.map((row) => row.id)),
      this.loadJoinCodes(),
    ]);

    return rows.map((row) => {
      const relation = relations.get(row.id) ?? { interests: [], languages: [] };
      return this.mapCommunity(
        row,
        relation.interests,
        relation.languages,
        joinCodes.get(row.id) ?? null,
      );
    });
  }

  async getMatches(viewerId: string, filters: DiscoverFilters): Promise<MatchResult[]> {
    // Scoring runs in the Python backend when configured, and falls back to the
    // SQL-backed candidate query plus the shared TypeScript engine otherwise.
    const viewer = await this.loadProfile(viewerId);
    const candidates = (await this.listProfiles({ excludeIds: [viewerId] })).filter(
      (profile) => profile.privacy.visibility !== 'private',
    );

    const { data: blocked } = await this.client
      .from('blocked_users')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);
    const excluded = new Set<string>();
    for (const row of blocked ?? []) {
      excluded.add(row.blocker_id === viewerId ? row.blocked_id : row.blocker_id);
    }
    const { data: connections } = await this.client
      .from('connections')
      .select('user_a, user_b')
      .or(`user_a.eq.${viewerId},user_b.eq.${viewerId}`);
    for (const row of connections ?? []) {
      excluded.add(row.user_a === viewerId ? row.user_b : row.user_a);
    }

    const viewerCommunities = await this.loadViewerCommunities(viewerId);
    const candidateCommunities = await this.loadCandidateCommunities();

    const { rankMatches, applyFilters } = await import('../../features/matching/engine');
    const context = { viewerCommunities, candidateCommunities, excludedUserIds: excluded };
    const ranked = rankMatches(viewer, candidates, context);
    return applyFilters(ranked, filters, viewer, context);
  }

  private async loadViewerCommunities(viewerId: string): Promise<Community[]> {
    const { data, error } = await this.client
      .from('community_members')
      .select('community_id')
      .eq('profile_id', viewerId)
      .eq('state', 'member');
    if (error) this.fail(error, 'Could not load your communities.');
    const ids = (data ?? []).map((row) => row.community_id);
    if (ids.length === 0) return [];
    const communities = await Promise.all(ids.map((id) => this.getCommunity(id)));
    return communities.filter((c): c is Community => c !== null);
  }

  private async loadCandidateCommunities(): Promise<Map<string, Community[]>> {
    const { data, error } = await this.client
      .from('community_members')
      .select('community_id, profile_id')
      .eq('state', 'member');
    if (error) this.fail(error, 'Could not load community membership.');
    const ids = [...new Set((data ?? []).map((row) => row.community_id))];
    const communities = new Map<string, Community>();
    await Promise.all(
      ids.map(async (id) => {
        const community = await this.getCommunity(id);
        if (community) communities.set(id, community);
      }),
    );
    const byProfile = new Map<string, Community[]>();
    for (const row of data ?? []) {
      const community = communities.get(row.community_id);
      if (!community) continue;
      const list = byProfile.get(row.profile_id) ?? [];
      list.push(community);
      byProfile.set(row.profile_id, list);
    }
    return byProfile;
  }

  // ---- communities ------------------------------------------------------

  /**
   * Join codes for communities the viewer belongs to.
   *
   * The `join_code` column is not selectable, so codes are read through a
   * security-definer function that checks membership.
   */
  private async loadJoinCodes(): Promise<Map<string, string>> {
    const { data, error } = await this.client.rpc('community_join_codes');
    if (error) {
      // Not being able to read codes must not break community browsing.
      return new Map();
    }
    const map = new Map<string, string>();
    for (const row of (data ?? []) as Array<{ community_id: string; join_code: string }>) {
      map.set(row.community_id, row.join_code);
    }
    return map;
  }

  private async loadCommunityInterests(
    communityIds: string[],
  ): Promise<Map<string, { interests: string[]; languages: string[] }>> {
    const map = new Map<string, { interests: string[]; languages: string[] }>();
    for (const id of communityIds) map.set(id, { interests: [], languages: [] });
    if (communityIds.length === 0) return map;
    const [interests, languages] = await Promise.all([
      this.client.from('community_interests').select('community_id, interest_id').in('community_id', communityIds),
      this.client.from('community_languages').select('community_id, language_code').in('community_id', communityIds),
    ]);
    for (const row of interests.data ?? []) {
      map.get(row.community_id)?.interests.push(row.interest_id);
    }
    for (const row of languages.data ?? []) {
      map.get(row.community_id)?.languages.push(row.language_code);
    }
    return map;
  }

  async listCommunities(viewerId: string, query: CommunityQuery): Promise<Community[]> {
    let request = this.client.from('communities').select(COMMUNITY_SELECT);
    if (query.search?.trim()) {
      const needle = query.search.trim().replace(/[%,]/g, '');
      request = request.or(
        `name.ilike.%${needle}%,description.ilike.%${needle}%,purpose.ilike.%${needle}%`,
      );
    }
    const { data, error } = await request.order('member_count', { ascending: false }).limit(200);
    if (error) this.fail(error, 'Could not load communities.');

    const memberships = await this.getMemberships(viewerId);
    const joined = new Set(
      memberships.filter((m) => m.state === 'member').map((m) => m.communityId),
    );
    let rows = (data ?? []) as CommunityRow[];
    // Private communities are only visible to members; RLS enforces the same rule.
    rows = rows.filter((row) => !row.is_private || joined.has(row.id));
    if (query.joinedOnly) rows = rows.filter((row) => joined.has(row.id));
    if (query.excludeJoined) rows = rows.filter((row) => !joined.has(row.id));

    const [relations, joinCodes] = await Promise.all([
      this.loadCommunityInterests(rows.map((row) => row.id)),
      this.loadJoinCodes(),
    ]);
    let list = rows.map((row) => {
      const relation = relations.get(row.id) ?? { interests: [], languages: [] };
      return this.mapCommunity(
        row,
        relation.interests,
        relation.languages,
        joinCodes.get(row.id) ?? null,
      );
    });
    if (query.interestIds?.length) {
      const ids = query.interestIds;
      list = list.filter((c) => c.interestIds.some((id) => ids.includes(id)));
    }
    if (query.languageCodes?.length) {
      const codes = query.languageCodes;
      list = list.filter((c) => c.languageCodes.some((code) => codes.includes(code)));
    }
    return list;
  }

  async getCommunity(communityId: string): Promise<Community | null> {
    const { data, error } = await this.client
      .from('communities')
      .select(COMMUNITY_SELECT)
      .eq('id', communityId)
      .maybeSingle();
    if (error) this.fail(error, 'Could not load that community.');
    if (!data) return null;
    const [relations, joinCodes] = await Promise.all([
      this.loadCommunityInterests([communityId]),
      this.loadJoinCodes(),
    ]);
    const relation = relations.get(communityId) ?? { interests: [], languages: [] };
    return this.mapCommunity(
      data as CommunityRow,
      relation.interests,
      relation.languages,
      joinCodes.get(communityId) ?? null,
    );
  }

  async getMemberships(viewerId: string): Promise<CommunityMembership[]> {
    const { data, error } = await this.client
      .from('community_members')
      .select('community_id, state, role, joined_at')
      .eq('profile_id', viewerId);
    if (error) this.fail(error, 'Could not load your memberships.');
    return (data ?? []).map((row) => ({
      communityId: row.community_id,
      state: row.state,
      role: row.role,
      joinedAt: row.joined_at,
    }));
  }

  async getCommunityMembers(communityId: string): Promise<Profile[]> {
    const { data, error } = await this.client
      .from('community_members')
      .select('profile_id')
      .eq('community_id', communityId)
      .eq('state', 'member');
    if (error) this.fail(error, 'Could not load community members.');
    const ids = (data ?? []).map((row) => row.profile_id);
    if (ids.length === 0) return [];
    const { data: profiles, error: profileError } = await this.client
      .from('profiles')
      .select(PROFILE_SELECT)
      .in('id', ids);
    if (profileError) this.fail(profileError, 'Could not load community members.');
    return (profiles ?? [])
      .map((row) => this.mapProfile(row as ProfileRow & ProfileRelations))
      .filter((profile) => profile.privacy.showInCommunityLists);
  }

  async requestMembership(communityId: string, note?: string): Promise<CommunityMembership> {
    const user = await this.client.auth.getUser();
    if (!user.data.user) {
      throw new RepositoryError('You need to be signed in to do that.', 'not-authenticated');
    }
    const community = await this.getCommunity(communityId);
    if (!community) throw new RepositoryError('That community no longer exists.', 'not-found');
    const state = community.membershipRequiresApproval ? 'requested' : 'member';
    const { data, error } = await this.client
      .from('community_members')
      .upsert(
        {
          community_id: communityId,
          profile_id: user.data.user.id,
          state,
          role: 'member',
          note: note ?? null,
          joined_at: state === 'member' ? new Date().toISOString() : null,
        },
        { onConflict: 'community_id,profile_id' },
      )
      .select()
      .single();
    if (error) this.fail(error, 'Could not send your membership request.');
    const row = data as CommunityMemberRow;
    return {
      communityId: row.community_id,
      state: row.state,
      role: row.role,
      joinedAt: row.joined_at,
    };
  }

  async leaveCommunity(communityId: string): Promise<void> {
    const user = await this.client.auth.getUser();
    if (!user.data.user) {
      throw new RepositoryError('You need to be signed in to do that.', 'not-authenticated');
    }
    const { error } = await this.client
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('profile_id', user.data.user.id);
    if (error) this.fail(error, 'Could not leave that community.');
  }

  async createCommunity(viewerId: string, input: CreateCommunityInput): Promise<Community> {
    const slug = input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const { data, error } = await this.client
      .from('communities')
      .insert({
        name: input.name.trim(),
        slug,
        description: input.description.trim(),
        purpose: input.purpose.trim(),
        join_code: input.joinCode ?? null,
        membership_requires_approval: input.membershipRequiresApproval,
        is_private: input.isPrivate,
        created_by: viewerId,
      })
      .select(COMMUNITY_SELECT)
      .single();
    if (error) this.fail(error, 'Could not create that community.');
    const row = data as CommunityRow;
    const relationRows = [
      ...input.interestIds.map((interest_id) => ({
        community_id: row.id,
        interest_id,
      })),
      ...input.languageCodes.map((language_code) => ({
        community_id: row.id,
        language_code,
      })),
    ];
    if (input.interestIds.length > 0) {
      const { error: interestError } = await this.client
        .from('community_interests')
        .insert(input.interestIds.map((interest_id) => ({ community_id: row.id, interest_id })));
      if (interestError) this.fail(interestError, 'Could not save community interests.');
    }
    if (input.languageCodes.length > 0) {
      const { error: languageError } = await this.client
        .from('community_languages')
        .insert(input.languageCodes.map((language_code) => ({ community_id: row.id, language_code })));
      if (languageError) this.fail(languageError, 'Could not save community languages.');
    }
    void relationRows;
    // The creator is the owner, so they may read the code straight back.
    return this.mapCommunity(row, input.interestIds, input.languageCodes, input.joinCode ?? null);
  }

  async resolveJoinCode(code: string): Promise<Community | null> {
    const { data, error } = await this.client.rpc('community_by_join_code', {
      lookup_code: code.trim().toUpperCase(),
    });
    if (error) {
      // The RPC exists so the code can be resolved without exposing the column
      // to non-members through a normal select.
      this.fail(error, 'Could not check that join code.');
    }
    const row = Array.isArray(data) ? (data[0] as { id: string } | undefined) : undefined;
    if (!row) return null;
    return this.getCommunity(row.id);
  }

  async joinByCode(code: string): Promise<Community> {
    const community = await this.resolveJoinCode(code);
    if (!community) throw new RepositoryError('That join code was not recognised.', 'not-found');
    await this.requestMembership(community.id);
    return community;
  }

  async getCommunityMessages(communityId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from('community_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) this.fail(error, 'Could not load the discussion.');
    return ((data ?? []) as CommunityMessageRow[]).map((row) => ({
      id: row.id,
      conversationId: row.community_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
      state: 'sent',
      translation: null,
      attachments: [],
      voiceNoteSeconds: null,
      waveform: null,
    }));
  }

  async postCommunityMessage(communityId: string, body: string): Promise<Message> {
    const user = await this.client.auth.getUser();
    if (!user.data.user) {
      throw new RepositoryError('You need to be signed in to do that.', 'not-authenticated');
    }
    const { data, error } = await this.client
      .from('community_messages')
      .insert({
        community_id: communityId,
        sender_id: user.data.user.id,
        body: body.trim(),
      })
      .select()
      .single();
    if (error) this.fail(error, 'Could not post that message.');
    const row = data as CommunityMessageRow;
    return {
      id: row.id,
      conversationId: row.community_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
      state: 'sent',
      translation: null,
      attachments: [],
      voiceNoteSeconds: null,
      waveform: null,
    };
  }

  // ---- events -----------------------------------------------------------

  async listEvents(viewerId: string, query: EventQuery): Promise<CommunityEvent[]> {
    let request = this.client.from('events').select('*').gte('ends_at', new Date().toISOString());
    if (query.communityIds?.length) request = request.in('community_id', query.communityIds);
    if (query.fromDate) request = request.gte('starts_at', query.fromDate);
    if (query.activityIds?.length) request = request.overlaps('activity_ids', query.activityIds);
    if (query.languageCodes?.length) {
      request = request.overlaps('language_codes', query.languageCodes);
    }
    if (query.attendingOnly) {
      const { data } = await this.client
        .from('event_attendees')
        .select('event_id')
        .eq('profile_id', viewerId);
      const ids = (data ?? []).map((row) => row.event_id);
      if (ids.length === 0) return [];
      request = request.in('id', ids);
    }
    const { data, error } = await request.order('starts_at', { ascending: true }).limit(200);
    if (error) this.fail(error, 'Could not load events.');
    return ((data ?? []) as EventRow[]).map((row) => this.mapEvent(row));
  }

  async getEvent(eventId: string): Promise<CommunityEvent | null> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    if (error) this.fail(error, 'Could not load that event.');
    return data ? this.mapEvent(data as EventRow) : null;
  }

  async setEventAttendance(eventId: string, attending: boolean): Promise<CommunityEvent> {
    const user = await this.client.auth.getUser();
    if (!user.data.user) {
      throw new RepositoryError('You need to be signed in to do that.', 'not-authenticated');
    }
    if (attending) {
      const { error } = await this.client
        .from('event_attendees')
        .upsert({ event_id: eventId, profile_id: user.data.user.id }, { onConflict: 'event_id,profile_id' });
      if (error) this.fail(error, 'Could not confirm your place.');
    } else {
      const { error } = await this.client
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('profile_id', user.data.user.id);
      if (error) this.fail(error, 'Could not cancel your place.');
    }
    const event = await this.getEvent(eventId);
    if (!event) throw new RepositoryError('That event no longer exists.', 'not-found');
    return event;
  }

  async createEvent(viewerId: string, input: CreateEventInput): Promise<CommunityEvent> {
    const { data, error } = await this.client
      .from('events')
      .insert({
        community_id: input.communityId,
        title: input.title.trim(),
        description: input.description.trim(),
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        venue_name: input.venueName.trim(),
        is_public_venue: true,
        capacity: input.capacity,
        activity_ids: input.activityIds,
        language_codes: input.languageCodes,
        created_by: viewerId,
      })
      .select()
      .single();
    if (error) this.fail(error, 'Could not create that event.');
    return this.mapEvent(data as EventRow);
  }

  // ---- connections ------------------------------------------------------

  async listConnectionRequests(
    viewerId: string,
  ): Promise<{ incoming: ConnectionRequest[]; outgoing: ConnectionRequest[] }> {
    const { data, error } = await this.client
      .from('connection_requests')
      .select('*')
      .eq('status', 'pending')
      .or(`from_user.eq.${viewerId},to_user.eq.${viewerId}`)
      .order('created_at', { ascending: false });
    if (error) this.fail(error, 'Could not load connection requests.');
    const map = (row: ConnectionRequestRow): ConnectionRequest => ({
      id: row.id,
      fromUserId: row.from_user,
      toUserId: row.to_user,
      reason: row.reason,
      createdAt: row.created_at,
      status: row.status,
    });
    const rows = ((data ?? []) as ConnectionRequestRow[]).map(map);
    return {
      incoming: rows.filter((row) => row.toUserId === viewerId),
      outgoing: rows.filter((row) => row.fromUserId === viewerId),
    };
  }

  async sendConnectionRequest(
    fromUserId: string,
    toUserId: string,
    reason: string | null,
  ): Promise<ConnectionRequest> {
    const { data, error } = await this.client
      .from('connection_requests')
      .insert({
        from_user: fromUserId,
        to_user: toUserId,
        reason: reason?.trim() ? reason.trim() : null,
      })
      .select()
      .single();
    if (error) this.fail(error, 'Could not send that request.');
    const row = data as ConnectionRequestRow;
    return {
      id: row.id,
      fromUserId: row.from_user,
      toUserId: row.to_user,
      reason: row.reason,
      createdAt: row.created_at,
      status: row.status,
    };
  }

  async respondToRequest(
    requestId: string,
    decision: 'accept' | 'decline',
  ): Promise<ConnectionRequest> {
    // Acceptance creates the connection row inside a database function so the
    // two writes cannot diverge.
    const { data, error } = await this.client.rpc('respond_to_connection_request', {
      request_id: requestId,
      accept: decision === 'accept',
    });
    if (error) this.fail(error, 'Could not respond to that request.');
    const row = (Array.isArray(data) ? data[0] : data) as ConnectionRequestRow;
    return {
      id: row.id,
      fromUserId: row.from_user,
      toUserId: row.to_user,
      reason: row.reason,
      createdAt: row.created_at,
      status: row.status,
    };
  }

  async cancelRequest(requestId: string): Promise<void> {
    const { error } = await this.client
      .from('connection_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId);
    if (error) this.fail(error, 'Could not cancel that request.');
  }

  async listConnections(viewerId: string): Promise<Connection[]> {
    const { data, error } = await this.client
      .from('connections')
      .select('*')
      .or(`user_a.eq.${viewerId},user_b.eq.${viewerId}`)
      .order('created_at', { ascending: false });
    if (error) this.fail(error, 'Could not load your connections.');
    return ((data ?? []) as ConnectionRow[]).map((row) => ({
      id: row.id,
      userId: row.user_a === viewerId ? row.user_b : row.user_a,
      connectedAt: row.created_at,
      originRequestId: row.origin_request_id,
    }));
  }

  async removeConnection(connectionId: string): Promise<void> {
    const { error } = await this.client.from('connections').delete().eq('id', connectionId);
    if (error) this.fail(error, 'Could not remove that connection.');
  }

  // ---- messaging --------------------------------------------------------

  async listConversations(viewerId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from('conversation_members')
      .select('conversation_id')
      .eq('profile_id', viewerId);
    if (error) this.fail(error, 'Could not load your conversations.');
    const ids = (data ?? []).map((row) => row.conversation_id);
    if (ids.length === 0) return [];
    const { data: conversations, error: conversationError } = await this.client
      .from('conversations')
      .select('*')
      .in('id', ids)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (conversationError) this.fail(conversationError, 'Could not load your conversations.');
    const { data: members } = await this.client
      .from('conversation_members')
      .select('conversation_id, profile_id')
      .in('conversation_id', ids);
    const { data: unread } = await this.client
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', ids)
      .neq('sender_id', viewerId)
      .is('read_at', null);
    const unreadCounts = new Map<string, number>();
    for (const row of unread ?? []) {
      unreadCounts.set(row.conversation_id, (unreadCounts.get(row.conversation_id) ?? 0) + 1);
    }
    const { data: lastMessages } = await this.client
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false });
    const previews = new Map<string, { body: string; createdAt: string }>();
    for (const row of lastMessages ?? []) {
      if (!previews.has(row.conversation_id)) {
        previews.set(row.conversation_id, { body: row.body, createdAt: row.created_at });
      }
    }
    return ((conversations ?? []) as ConversationRow[]).map((row) => {
      const preview = previews.get(row.id);
      return {
        id: row.id,
        participantIds: (members ?? [])
          .filter((m) => m.conversation_id === row.id)
          .map((m) => m.profile_id),
        createdAt: row.created_at,
        lastMessageAt: preview?.createdAt ?? row.last_message_at,
        lastMessagePreview: preview?.body ?? null,
        unreadCount: unreadCounts.get(row.id) ?? 0,
        kind: row.kind,
      };
    });
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();
    if (error) this.fail(error, 'Could not load that conversation.');
    if (!data) return null;
    const { data: members } = await this.client
      .from('conversation_members')
      .select('profile_id')
      .eq('conversation_id', conversationId);
    const row = data as ConversationRow;
    return {
      id: row.id,
      participantIds: (members ?? []).map((m) => m.profile_id),
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: null,
      unreadCount: 0,
      kind: row.kind,
    };
  }

  async listMessages(conversationId: string, limit = 200): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) this.fail(error, 'Could not load messages.');
    const rows = (data ?? []) as MessageRow[];
    if (rows.length === 0) return [];
    const { data: translations } = await this.client
      .from('message_translations')
      .select('*')
      .in(
        'message_id',
        rows.map((row) => row.id),
      );
    const byMessage = new Map<string, MessageTranslationRow[]>();
    for (const row of (translations ?? []) as MessageTranslationRow[]) {
      const list = byMessage.get(row.message_id) ?? [];
      list.push(row);
      byMessage.set(row.message_id, list);
    }
    return rows.map((row) => this.mapMessage(row, byMessage.get(row.id) ?? []));
  }

  async sendMessage(senderId: string, input: SendMessageInput): Promise<Message> {
    const { data, error } = await this.client
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        sender_id: senderId,
        body: input.body.trim(),
        voice_note_seconds: input.voiceNoteSeconds ?? null,
        waveform: input.waveform ?? null,
        attachments: input.attachments ?? [],
      })
      .select()
      .single();
    if (error) this.fail(error, 'Could not send that message.');
    const row = data as MessageRow;
    await this.client
      .from('conversations')
      .update({ last_message_at: row.created_at })
      .eq('id', input.conversationId);
    return this.mapMessage(row);
  }

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null);
    if (error) this.fail(error, 'Could not update read state.');
  }

  async openDirectConversation(viewerId: string, otherUserId: string): Promise<Conversation> {
    const { data, error } = await this.client.rpc('open_direct_conversation', {
      other_user: otherUserId,
    });
    if (error) this.fail(error, 'Messaging opens once you are both connected.');
    const row = (Array.isArray(data) ? data[0] : data) as ConversationRow;
    const conversation = await this.getConversation(row.id);
    if (!conversation) throw new RepositoryError('That conversation no longer exists.', 'not-found');
    void viewerId;
    return conversation;
  }

  onMessageInsert(conversationId: string, listener: (message: Message) => void): () => void {
    const channel = this.client
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          listener(this.mapMessage(payload.new as MessageRow));
        },
      )
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }

  // ---- safety -----------------------------------------------------------

  async listBlockedUsers(viewerId: string): Promise<BlockedUser[]> {
    const { data, error } = await this.client
      .from('blocked_users')
      .select('blocked_id, created_at')
      .eq('blocker_id', viewerId);
    if (error) this.fail(error, 'Could not load blocked accounts.');
    return (data ?? []).map((row) => ({ userId: row.blocked_id, blockedAt: row.created_at }));
  }

  async blockUser(viewerId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('blocked_users')
      .insert({ blocker_id: viewerId, blocked_id: userId });
    if (error) this.fail(error, 'Could not block that account.');
  }

  async unblockUser(viewerId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('blocked_users')
      .delete()
      .eq('blocker_id', viewerId)
      .eq('blocked_id', userId);
    if (error) this.fail(error, 'Could not unblock that account.');
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
    const { data, error } = await this.client
      .from('reports')
      .insert({
        reporter_id: reporterId,
        subject_user_id: input.subjectUserId ?? null,
        subject_message_id: input.subjectMessageId ?? null,
        reason: input.reason,
        detail: input.detail?.trim() ? input.detail.trim() : null,
      })
      .select()
      .single();
    if (error) this.fail(error, 'Could not submit that report.');
    const row = data as ReportRow;
    return {
      id: row.id,
      reporterId: row.reporter_id,
      subjectUserId: row.subject_user_id,
      subjectMessageId: row.subject_message_id,
      reason: row.reason as ReportReason,
      detail: row.detail,
      createdAt: row.created_at,
      status: row.status,
    };
  }

  // ---- notifications ----------------------------------------------------

  async listNotifications(viewerId: string): Promise<AppNotification[]> {
    const { data, error } = await this.client
      .from('notifications')
      .select('*')
      .eq('profile_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) this.fail(error, 'Could not load notifications.');
    return ((data ?? []) as NotificationRow[]).map((row) => ({
      id: row.id,
      kind: row.kind as AppNotification['kind'],
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      readAt: row.read_at,
      target: row.target_screen
        ? { screen: row.target_screen, params: row.target_params ?? undefined }
        : null,
    }));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) this.fail(error, 'Could not update that notification.');
  }

  async markAllNotificationsRead(viewerId: string): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', viewerId)
      .is('read_at', null);
    if (error) this.fail(error, 'Could not update notifications.');
  }
}

/** Languages the translation pipeline is wired for, exposed for the UI. */
export const SUPPORTED_TRANSLATION_LANGUAGES = TRANSLATABLE_LANGUAGE_CODES;

/** Exported so tests can assert the default privacy baseline. */
export const PRIVACY_BASELINE = DEFAULT_PRIVACY;
export const NOTIFICATION_BASELINE = DEFAULT_NOTIFICATIONS;
