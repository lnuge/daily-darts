import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// The publishable key (sb_publishable_...) or legacy anon key. Safe in the browser:
// Row Level Security decides what it can do. Never put a secret/service_role key here.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Supabase client, or null when env vars aren't set (see .env.example), so
 * the game still runs offline / without a backend during development.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // PKCE is the recommended OAuth flow for browser apps; the code in the
          // redirect URL is exchanged for a session automatically.
          flowType: 'pkce',
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null
