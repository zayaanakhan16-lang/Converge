/**
 * Database row types.
 *
 * Hand-maintained to match `supabase/migrations`. Regenerate after schema
 * changes with:
 *   npx supabase gen types typescript --project-id <ref> > src/services/supabase/database.types.ts
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; display_name: string };
        Update: Partial<ProfileRow>;
      };
      interests: { Row: { id: string; label: string; category: string } };
      skills: { Row: { id: string; label: string; skill_group: string } };
      languages: {
        Row: { code: string; label: string; native_label: string; translatable: boolean };
      };
      profile_interests: { Row: { profile_id: string; interest_id: string } };
      profile_skills: { Row: { profile_id: string; skill_id: string; intent: 'offer' | 'learn' } };
      profile_languages: { Row: { profile_id: string; language_code: string; proficiency: string } };
      profile_goals: { Row: { profile_id: string; goal_id: string } };
      profile_activities: { Row: { profile_id: string; activity_id: string } };
      communities: { Row: CommunityRow };
      community_members: { Row: CommunityMemberRow };
      events: { Row: EventRow };
      event_attendees: { Row: { event_id: string; profile_id: string; created_at: string } };
      connection_requests: { Row: ConnectionRequestRow };
      connections: { Row: ConnectionRow };
      conversations: { Row: ConversationRow };
      conversation_members: { Row: { conversation_id: string; profile_id: string } };
      messages: { Row: MessageRow };
      message_translations: { Row: MessageTranslationRow };
      community_messages: { Row: CommunityMessageRow };
      reports: { Row: ReportRow };
      blocked_users: { Row: { blocker_id: string; blocked_id: string; created_at: string } };
      notifications: { Row: NotificationRow };
      match_scores: { Row: MatchScoreRow };
    };
    Functions: {
      is_connected: { Args: { a: string; b: string }; Returns: boolean };
      are_blocked: { Args: { a: string; b: string }; Returns: boolean };
      is_conversation_member: { Args: { conversation: string }; Returns: boolean };
      is_community_member: { Args: { community: string }; Returns: boolean };
      /**
       * Nearby discovery. All three return a narrow projection; none returns a
       * coordinate, and `distance_km` is rounded to whole kilometres.
       */
      nearby_profiles: {
        Args: {
          viewer: string;
          center_lat: number;
          center_lng: number;
          radius_km?: number;
          max_results?: number;
        };
        Returns: Array<{
          id: string;
          display_name: string;
          headline: string | null;
          area_label: string | null;
          city: string | null;
          country_code: string | null;
          distance_km: number;
        }>;
      };
      nearby_communities: {
        Args: {
          viewer: string;
          center_lat: number;
          center_lng: number;
          radius_km?: number;
          max_results?: number;
        };
        Returns: Array<{
          id: string;
          name: string;
          slug: string;
          purpose: string;
          area_label: string | null;
          city: string | null;
          country_code: string | null;
          is_private: boolean;
          member_count: number;
          distance_km: number;
        }>;
      };
      profiles_in_place: {
        Args: {
          viewer: string;
          place_city?: string | null;
          place_country?: string | null;
          max_results?: number;
        };
        Returns: Array<{
          id: string;
          display_name: string;
          headline: string | null;
          area_label: string | null;
          city: string | null;
          country_code: string | null;
        }>;
      };
      community_by_join_code: {
        Args: { lookup_code: string };
        Returns: Array<{ id: string }>;
      };
      community_join_code: {
        Args: { community: string };
        Returns: string | null;
      };
      community_join_codes: {
        Args: Record<string, never>;
        Returns: Array<{ community_id: string; join_code: string }>;
      };
      respond_to_connection_request: {
        Args: { request_id: string; accept: boolean };
        Returns: ConnectionRequestRow;
      };
      open_direct_conversation: {
        Args: { other_user: string };
        Returns: ConversationRow;
      };
    };
  };
}

export interface ProfileRow {
  id: string;
  display_name: string;
  /** Object key inside the private `avatars` bucket. Not a URL. */
  avatar_path: string | null;
  photo_visibility: 'public' | 'community' | 'connections' | 'private';
  headline: string | null;
  bio: string | null;
  visibility: 'community' | 'discoverable' | 'private';
  share_approximate_location: boolean;
  allow_connection_requests: boolean;
  show_in_community_lists: boolean;
  notify_connection_requests: boolean;
  notify_messages: boolean;
  notify_community_activity: boolean;
  notify_event_reminders: boolean;
  notify_product_updates: boolean;
  latitude: number | null;
  longitude: number | null;
  area_label: string | null;
  city: string | null;
  country_code: string | null;
  /** Opt-in to appearing in Nearby Network results. */
  nearby_discovery_enabled: boolean;
  /** When the coarse area was last written, so a stale area can be aged out. */
  location_updated_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  purpose: string;
  join_code: string | null;
  membership_requires_approval: boolean;
  member_count: number;
  cover_colour: string;
  is_private: boolean;
  latitude: number | null;
  longitude: number | null;
  area_label: string | null;
  city: string | null;
  country_code: string | null;
  location_updated_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CommunityMemberRow {
  community_id: string;
  profile_id: string;
  state: 'requested' | 'invited' | 'member';
  role: 'member' | 'organiser' | 'owner';
  note: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  community_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  is_public_venue: boolean;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  attendee_count: number;
  activity_ids: string[];
  language_codes: string[];
  created_by: string | null;
  created_at: string;
}

export interface ConnectionRequestRow {
  id: string;
  from_user: string;
  to_user: string;
  reason: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  responded_at: string | null;
}

export interface ConnectionRow {
  id: string;
  user_a: string;
  user_b: string;
  origin_request_id: string | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  kind: 'direct' | 'group';
  community_id: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  voice_note_seconds: number | null;
  waveform: number[] | null;
  attachments: unknown;
  created_at: string;
  edited_at: string | null;
}

export interface MessageTranslationRow {
  id: string;
  message_id: string;
  target_language: string;
  text: string;
  provider: string;
  was_translated: boolean;
  created_at: string;
}

export interface CommunityMessageRow {
  id: string;
  community_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  subject_user_id: string | null;
  subject_message_id: string | null;
  reason: string;
  detail: string | null;
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
  created_at: string;
}

export interface NotificationRow {
  id: string;
  profile_id: string;
  kind: string;
  title: string;
  body: string;
  target_screen: string | null;
  target_params: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

export interface MatchScoreRow {
  viewer_id: string;
  candidate_id: string;
  score: number;
  reasons: unknown;
  computed_at: string;
}
