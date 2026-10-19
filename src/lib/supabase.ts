import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Supabase client, or null when env vars aren't set (see .env.example), so
 * the game still runs offline / without a backend during development.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
