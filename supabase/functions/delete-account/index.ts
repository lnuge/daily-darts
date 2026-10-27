/**
 * delete-account: deletes the signed-in player's account and everything
 * stored about them.
 *
 * POST, with the player's session token as the Authorization bearer.
 *
 * Deleting the auth user (with the service role, the supported way) removes
 * their sessions and any linked Google identity; the database then deletes
 * their profile and, through it, every round (`on delete cascade`, see
 * supabase/migrations/20261020120000_profiles_and_rounds.sql and
 * supabase/tests/delete-account.test.ts). Leaderboards and stats are computed
 * from what's left, so the player disappears from them straight away.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  // Provided automatically to every Supabase edge function.
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
    return json(500, { error: 'server_misconfigured' })
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Only ever the caller's own account: the id comes from their session token.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: null }
  if (authError || !auth.user) {
    return json(401, { error: 'unauthorized', message: 'Sign in first.' })
  }

  const { error } = await admin.auth.admin.deleteUser(auth.user.id)
  if (error) {
    console.error(`Deleting ${auth.user.id} failed: ${error.message}`)
    return json(500, { error: 'server_error', message: "Couldn't delete the account." })
  }
  return json(200, { deleted: true })
})
