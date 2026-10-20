/**
 * Sends a finished ranked round to the submit-round edge function, which
 * replays it on the server and saves the verified score. Only the date and
 * throw inputs are sent; the server works out the score itself.
 */

import { FunctionsHttpError } from '@supabase/supabase-js'
import type { ThrowInput } from '../game/throw'
import { ensureSession } from './auth'
import { loadJson, saveJson } from './storage'
import { supabase } from './supabase'

export type SubmitOutcome =
  /** Supabase isn't configured: nothing to submit to. */
  | { kind: 'offline' }
  | { kind: 'verified'; totalDarts: number }
  /** The server already has this player's round for the day. */
  | { kind: 'already' }
  /** The server refused the round for good (closed date etc.). Retrying won't help. */
  | { kind: 'rejected'; message: string }
  /** Couldn't reach the server, or it failed. Worth retrying. */
  | { kind: 'failed'; message: string }

const keyFor = (date: string) => `submitted:${date}`

/** Whether this device already got the day's round accepted, so it isn't sent again. */
export function isSubmitted(date: string): boolean {
  return loadJson<boolean>(keyFor(date)) === true
}

/** Errors the server will give again however often it's asked. */
const PERMANENT = new Set(['future_date', 'date_closed', 'invalid_round', 'round_not_finished'])

export async function submitRankedRound(
  date: string,
  inputs: readonly ThrowInput[],
): Promise<SubmitOutcome> {
  if (!supabase) return { kind: 'offline' }

  // Rounds belong to a player: a guest session is enough.
  const session = await ensureSession()
  if (!session) return { kind: 'failed', message: "Couldn't start a session." }

  const { data, error } = await supabase.functions.invoke('submit-round', {
    body: { puzzle_date: date, inputs: inputs.map(({ lockX, lockY }) => ({ lockX, lockY })) },
  })

  if (!error) {
    saveJson(keyFor(date), true)
    return { kind: 'verified', totalDarts: data.total_darts as number }
  }

  if (error instanceof FunctionsHttpError) {
    const body = (await (error.context as Response).json().catch(() => null)) as {
      error?: string
      message?: string
    } | null
    if (body?.error === 'already_submitted') {
      saveJson(keyFor(date), true)
      return { kind: 'already' }
    }
    if (body?.error && PERMANENT.has(body.error)) {
      return { kind: 'rejected', message: body.message ?? body.error }
    }
    // Only show messages written by submit-round itself; anything else (e.g. a
    // gateway error page) gets a plain explanation.
    return {
      kind: 'failed',
      message: body?.error && body.message ? body.message : 'The server had a problem.',
    }
  }
  // FunctionsFetchError / FunctionsRelayError: never reached the function.
  return { kind: 'failed', message: "Couldn't reach the server. Are you online?" }
}
