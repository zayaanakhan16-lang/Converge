import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

import { supabaseConfig } from '../../constants/config';

/**
 * Supabase client.
 *
 * The anon key is a public value: every table is protected by Row Level
 * Security, so the key alone grants nothing. The session is persisted in
 * AsyncStorage rather than SecureStore because it is a rotating refresh token
 * pair managed by the SDK, and SecureStore rejects payloads of this size on
 * some Android devices.
 */

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfig.isConfigured) return null;
  if (client) return client;
  client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** Supabase needs an explicit refresh trigger while the app is foregrounded. */
export function startSupabaseAutoRefresh(): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
  return () => subscription.remove();
}
