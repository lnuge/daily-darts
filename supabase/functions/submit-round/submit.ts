/**
 * The logic of submit-round, kept free of Deno and network code so it can be
 * tested with Vitest. index.ts wires it to HTTP and the database.
 *
 * The client sends only the day and its throw inputs. The score is always
 * worked out here by replaying them; anything else in the request is ignored.
 */

import { parseDateKey } from '../_shared/game/date.ts'
import { replayRound } from '../_shared/game/round.ts'
import type { ThrowInput } from '../_shared/game/throw.ts'

/** A round has at most 3 targets × 30 darts. */
export const MAX_INPUTS = 90

/**
 * Hours a puzzle stays open after it has ended everywhere on Earth, for a
 * player who finishes just before midnight or submits after being offline.
 */
export const GRACE_HOURS = 6

/** Time zones run from UTC-12 to UTC+14, so a date is "today" somewhere for 50 hours. */
const EARLIEST_ZONE_HOURS = -12
const LATEST_ZONE_HOURS = 14
const HOUR_MS = 3_600_000

export type VerifiedRound = {
  user_id: string
  puzzle_date: string
  inputs: ThrowInput[]
  total_darts: number
  per_target: { target: number; darts: number; outcome: 'checkout' | 'capped' | null }[]
  verified: true
}

export type SaveResult = { ok: true; createdAt: string } | { ok: false; reason: 'duplicate' }

/** Where verified rounds are saved. In production, the rounds table via the service role. */
export type RoundStore = {
  insertVerified(round: VerifiedRound): Promise<SaveResult>
}

export type ErrorCode =
  | 'invalid_request'
  | 'future_date'
  | 'date_closed'
  | 'invalid_round'
  | 'round_not_finished'
  | 'already_submitted'

export type SubmitResponse =
  | { status: 201; body: Omit<VerifiedRound, 'user_id' | 'inputs'> & { created_at: string } }
  | { status: 400 | 409 | 422; body: { error: ErrorCode; message: string } }

const utcDateKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The puzzle dates that are "today" somewhere on Earth right now, or were within GRACE_HOURS. */
export function acceptedDates(now: Date): { earliest: string; latest: string } {
  const t = now.getTime()
  return {
    earliest: utcDateKey(t + (EARLIEST_ZONE_HOURS - GRACE_HOURS) * HOUR_MS),
    latest: utcDateKey(t + LATEST_ZONE_HOURS * HOUR_MS),
  }
}

type Submission = { puzzleDate: string; inputs: ThrowInput[] }

/** Reads `{ puzzle_date, inputs }` from the request body; everything else is ignored. */
export function parseSubmission(body: unknown): Submission | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Expected a JSON object.' }
  const { puzzle_date: puzzleDate, inputs } = body as Record<string, unknown>

  if (typeof puzzleDate !== 'string') return { error: 'puzzle_date must be a YYYY-MM-DD string.' }
  try {
    parseDateKey(puzzleDate)
  } catch {
    return { error: 'puzzle_date must be a real date as YYYY-MM-DD.' }
  }

  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > MAX_INPUTS) {
    return { error: `inputs must be a list of 1 to ${MAX_INPUTS} throws.` }
  }
  const throws: ThrowInput[] = []
  for (const input of inputs) {
    const { lockX, lockY } = (input ?? {}) as Record<string, unknown>
    if (typeof lockX !== 'number' || typeof lockY !== 'number') {
      return { error: 'Each input must be { lockX, lockY } with numbers.' }
    }
    throws.push({ lockX, lockY }) // drop any other fields
  }
  return { puzzleDate, inputs: throws }
}

const fail = (status: 400 | 409 | 422, error: ErrorCode, message: string): SubmitResponse => ({
  status,
  body: { error, message },
})

/** Validates, replays and saves a ranked round for `userId`. */
export async function submitRound(
  body: unknown,
  userId: string,
  now: Date,
  store: RoundStore,
): Promise<SubmitResponse> {
  const submission = parseSubmission(body)
  if ('error' in submission) return fail(400, 'invalid_request', submission.error)
  const { puzzleDate, inputs } = submission

  const { earliest, latest } = acceptedDates(now)
  if (puzzleDate > latest) {
    return fail(422, 'future_date', `The puzzle for ${puzzleDate} hasn't started anywhere yet.`)
  }
  if (puzzleDate < earliest) {
    return fail(422, 'date_closed', `The puzzle for ${puzzleDate} is closed for ranked play.`)
  }

  let state
  try {
    state = replayRound(puzzleDate, inputs)
  } catch (error) {
    return fail(422, 'invalid_round', `The throws don't replay: ${(error as Error).message}`)
  }
  if (!state.finished) {
    return fail(422, 'round_not_finished', 'The throws end before all three targets are done.')
  }

  // Everything saved below comes from the server's replay, not the request.
  const round: VerifiedRound = {
    user_id: userId,
    puzzle_date: puzzleDate,
    inputs,
    total_darts: state.totalDarts,
    per_target: state.targets.map(({ target, darts, outcome }) => ({ target, darts, outcome })),
    verified: true,
  }
  const saved = await store.insertVerified(round)
  if (!saved.ok) {
    return fail(409, 'already_submitted', `You already have a ranked round for ${puzzleDate}.`)
  }
  return {
    status: 201,
    body: {
      puzzle_date: round.puzzle_date,
      total_darts: round.total_darts,
      per_target: round.per_target,
      verified: true,
      created_at: saved.createdAt,
    },
  }
}
