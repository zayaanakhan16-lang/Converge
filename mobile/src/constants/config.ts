/**
 * Runtime configuration.
 *
 * All values come from `EXPO_PUBLIC_*` environment variables so no key or
 * endpoint is ever committed. See `.env.example` in the repository root.
 *
 * When Supabase credentials are absent the app runs in demo mode: every screen
 * works against the local dataset in `src/data` and the UI says so explicitly.
 */

/**
 * Read one environment variable.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time, and only for a
 * literal member access. `process.env[name]` is left alone by the transformer
 * and is therefore always undefined in a release build, so each variable has to
 * be named literally here.
 */
function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

const supabaseUrl = readEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = readEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const backendUrl = readEnv(process.env.EXPO_PUBLIC_BACKEND_URL);

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  /** True when both Supabase values are present and look plausible. */
  isConfigured: /^https?:\/\//.test(supabaseUrl) && supabaseAnonKey.length > 20,
} as const;

export const backendConfig = {
  url: backendUrl.replace(/\/+$/, ''),
  isConfigured: /^https?:\/\//.test(backendUrl),
  /** AI features require the Python service; they are disabled without it. */
  requestTimeoutMs: 20_000,
} as const;

export const mapConfig = {
  /** Vector style for MapLibre. OpenFreeMap serves OpenStreetMap data. */
  styleUrl:
    readEnv(process.env.EXPO_PUBLIC_MAP_STYLE_URL) ||
    'https://tiles.openfreemap.org/styles/liberty',
  /** Coordinates are snapped to this grid before being stored or sent. */
  privacyGridDegrees: 0.05,
  defaultZoom: 11.5,
} as const;

export const config = {
  supabase: supabaseConfig,
  backend: backendConfig,
  maps: mapConfig,
  /** Demo mode is on whenever Supabase is not configured. */
  demoMode: !supabaseConfig.isConfigured,
  appVersion: '0.1.0',
  schemaVersion: 1,
} as const;

export const demoModeReason = supabaseConfig.isConfigured
  ? null
  : 'Supabase is not configured, so Converge is running on the local demo dataset.';

export const aiUnavailableReason = backendConfig.isConfigured
  ? null
  : 'The Converge backend URL is not configured, so AI features are unavailable.';
