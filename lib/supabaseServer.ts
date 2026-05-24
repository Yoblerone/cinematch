import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

/** Server-side Supabase client (service role). Returns null if env is not configured. */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!admin) {
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

export function isCatalogMatchEnabled(): boolean {
  const mode = (process.env.MATCH_SOURCE ?? 'supabase').toLowerCase();
  return mode !== 'tmdb';
}
