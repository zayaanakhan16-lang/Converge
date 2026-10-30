import { supabaseConfig } from '../constants/config';
import { DemoRepository } from './demo/DemoRepository';
import { getSupabaseClient } from './supabase/client';
import { SupabaseRepository } from './supabase/SupabaseRepository';
import type { Repository } from './types';

/**
 * Repository selection.
 *
 * Supabase is used whenever credentials are present; otherwise the app runs on
 * the labelled demo dataset. The choice is made once, at module load, so a
 * screen can never observe two different backends in one session.
 */

function createRepository(): Repository {
  if (supabaseConfig.isConfigured) {
    const client = getSupabaseClient();
    if (client) return new SupabaseRepository(client);
  }
  return new DemoRepository();
}

let instance: Repository | null = null;

export function repository(): Repository {
  if (!instance) instance = createRepository();
  return instance;
}

/** Test seam: swap the active repository without touching module state. */
export function setRepository(next: Repository | null): void {
  instance = next;
}

export { DemoRepository, SupabaseRepository };
export * from './types';
