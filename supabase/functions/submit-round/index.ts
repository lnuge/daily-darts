/**
 * submit-round: verifies and saves a player's ranked round.
 *
 * POST { puzzle_date: "2026-11-01", inputs: [{ lockX, lockY }, ...] }
 * with the player's session token as the Authorization bearer.
 *
 * The round is replayed here with the same game code as the browser (a synced
 * copy in ../_shared/game). Only the server's result is saved, as verified.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { submitRound, type RoundStore } from './submit.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** A real submission is a few kilobytes; refuse anything much bigger before parsing it. */
const MAX_BODY_CHARS = 16_384

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
  // The service role bypasses RLS: it's the only way to write a verified round.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Who's submitting, checked with Supabase Auth from their own session token.
  // Guests (anonymous users) count: they're real users with an id.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: null }
  if (authError || !auth.user) {
    return json(401, {
      error: 'unauthorized',
      message: 'Sign in (or start a guest session) first.',
    })
  }

  const text = await req.text()
  if (text.length > MAX_BODY_CHARS) return json(413, { error: 'payload_too_large' })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'invalid_request', message: 'The body must be JSON.' })
  }

  const store: RoundStore = {
    async insertVerified(round) {
      const { data, error } = await admin.from('rounds').insert(round).select('created_at').single()
      // unique (user_id, puzzle_date): they already have a ranked round for this day.
      if (error?.code === '23505') return { ok: false, reason: 'duplicate' }
      if (error) throw new Error(`Saving the round failed: ${error.message}`)
      return { ok: true, createdAt: data.created_at as string }
    },
  }

  try {
    const result = await submitRound(body, auth.user.id, new Date(), store)
    return json(result.status, result.body)
  } catch (error) {
    console.error(error)
    return json(500, { error: 'server_error', message: 'Something went wrong saving the round.' })
  }
})
