import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayRound } from '../../src/game/round.ts'
import { playRoundToFinish } from '../../src/game/test-helpers.ts'
import {
  GRACE_HOURS,
  MAX_INPUTS,
  acceptedDates,
  submitRound,
  type RoundStore,
  type VerifiedRound,
} from '../functions/submit-round/submit.ts'

const DATE = '2026-11-01'
const NOON = new Date('2026-11-01T12:00:00Z')
const USER = 'b0c1d2e3-0000-4000-8000-000000000001'
const finishing = playRoundToFinish(DATE)

/** An in-memory rounds table with the real unique (user_id, puzzle_date) rule. */
function memoryStore() {
  const rows: VerifiedRound[] = []
  const store: RoundStore = {
    async insertVerified(round) {
      if (rows.some((r) => r.user_id === round.user_id && r.puzzle_date === round.puzzle_date)) {
        return { ok: false, reason: 'duplicate' }
      }
      rows.push(round)
      return { ok: true, createdAt: '2026-11-01T12:00:01.000Z' }
    },
  }
  return { rows, store }
}

const submit = (body: unknown, now = NOON, store = memoryStore().store) =>
  submitRound(body, USER, now, store)

describe('submit-round: a valid round', () => {
  it('replays the throws and saves the server-computed score, verified', async () => {
    const { rows, store } = memoryStore()
    const result = await submit({ puzzle_date: DATE, inputs: finishing }, NOON, store)
    const replay = replayRound(DATE, finishing)

    expect(result.status).toBe(201)
    expect(rows).toEqual([
      {
        user_id: USER,
        puzzle_date: DATE,
        inputs: finishing,
        total_darts: replay.totalDarts,
        per_target: replay.targets.map(({ target, darts, outcome }) => ({
          target,
          darts,
          outcome,
        })),
        verified: true,
      },
    ])
    expect(result.body).toMatchObject({ puzzle_date: DATE, total_darts: 7, verified: true })
  })

  it('ignores any score, owner or verified flag the client sends', async () => {
    const { rows, store } = memoryStore()
    await submit(
      {
        puzzle_date: DATE,
        inputs: finishing.map((i) => ({ ...i, points: 180 })),
        total_darts: 3,
        per_target: [],
        verified: false,
        user_id: 'someone-else',
      },
      NOON,
      store,
    )
    expect(rows[0].user_id).toBe(USER)
    expect(rows[0].total_darts).toBe(7)
    expect(rows[0].inputs).toEqual(finishing) // extra fields stripped
  })
})

describe('submit-round: rejections', () => {
  it('rejects a second ranked round for the same day', async () => {
    const { rows, store } = memoryStore()
    await submit({ puzzle_date: DATE, inputs: finishing }, NOON, store)
    const again = await submit({ puzzle_date: DATE, inputs: finishing }, NOON, store)
    expect(again).toMatchObject({ status: 409, body: { error: 'already_submitted' } })
    expect(rows).toHaveLength(1)
  })

  it('rejects a round that does not finish', async () => {
    const result = await submit({ puzzle_date: DATE, inputs: finishing.slice(0, -1) })
    expect(result).toMatchObject({ status: 422, body: { error: 'round_not_finished' } })
  })

  it('rejects throws after the round finished', async () => {
    const result = await submit({
      puzzle_date: DATE,
      inputs: [...finishing, { lockX: 1, lockY: 2 }],
    })
    expect(result).toMatchObject({ status: 422, body: { error: 'invalid_round' } })
  })

  it('rejects throws that could not have happened', async () => {
    for (const bad of [
      { lockX: 500, lockY: 100 }, // second tap before the first
      { lockX: 0.5, lockY: 100 }, // not whole milliseconds
      { lockX: -1, lockY: 100 },
    ]) {
      const result = await submit({ puzzle_date: DATE, inputs: [bad, ...finishing.slice(1)] })
      expect(result).toMatchObject({ status: 422, body: { error: 'invalid_round' } })
    }
  })

  it('saves nothing for any rejected round', async () => {
    const { rows, store } = memoryStore()
    await submit({ puzzle_date: DATE, inputs: finishing.slice(0, 3) }, NOON, store)
    await submit({ puzzle_date: '2026-11-05', inputs: finishing }, NOON, store)
    expect(rows).toEqual([])
  })

  it.each([
    ['no body', null],
    ['a list', []],
    ['a missing date', { inputs: finishing }],
    ['a date in the wrong format', { puzzle_date: '01/11/2026', inputs: finishing }],
    ['an impossible date', { puzzle_date: '2026-02-30', inputs: finishing }],
    ['no inputs', { puzzle_date: DATE, inputs: [] }],
    ['inputs that are not a list', { puzzle_date: DATE, inputs: 'T20 T20 Bull' }],
    ['inputs that are not throws', { puzzle_date: DATE, inputs: [{ x: 1 }] }],
    [
      'too many inputs',
      { puzzle_date: DATE, inputs: Array(MAX_INPUTS + 1).fill({ lockX: 0, lockY: 0 }) },
    ],
  ])('rejects %s as a bad request', async (_, body) => {
    expect(await submit(body)).toMatchObject({ status: 400, body: { error: 'invalid_request' } })
  })
})

describe('submit-round: which dates are open', () => {
  const at = (iso: string) => acceptedDates(new Date(iso))

  it('accepts every date that is today somewhere on Earth', () => {
    // At 12:00 UTC it's 00:00 the next day in UTC+12 and later; UTC+14 is at 02:00.
    expect(at('2026-11-01T12:00:00Z')).toEqual({ earliest: '2026-10-31', latest: '2026-11-02' })
  })

  it('opens a date when it starts in UTC+14 (10:00 UTC the day before)', () => {
    expect(at('2026-10-31T09:59:59Z').latest).toBe('2026-10-31')
    expect(at('2026-10-31T10:00:00Z').latest).toBe('2026-11-01')
  })

  it(`closes a date ${GRACE_HOURS}h after it ends in UTC-12 (12:00 UTC the day after)`, () => {
    const closes = new Date(Date.UTC(2026, 10, 2, 12 + GRACE_HOURS))
    expect(acceptedDates(new Date(closes.getTime() - 1)).earliest).toBe('2026-11-01')
    expect(acceptedDates(closes).earliest).toBe('2026-11-02')
  })

  it('rejects a date in the future', async () => {
    const result = await submit(
      { puzzle_date: DATE, inputs: finishing },
      new Date('2026-10-31T09:00:00Z'),
    )
    expect(result).toMatchObject({ status: 422, body: { error: 'future_date' } })
  })

  it('rejects a date that has closed', async () => {
    const result = await submit(
      { puzzle_date: DATE, inputs: finishing },
      new Date('2026-11-03T00:00:00Z'),
    )
    expect(result).toMatchObject({ status: 422, body: { error: 'date_closed' } })
  })

  it('accepts a round finished just before midnight in the last time zone', async () => {
    const result = await submit(
      { puzzle_date: DATE, inputs: finishing },
      new Date('2026-11-02T11:59:00Z'),
    )
    expect(result.status).toBe(201)
  })
})

describe('shared game code', () => {
  it('is in sync with src/game (run `npm run sync:game` if this fails)', () => {
    const script = join(import.meta.dirname, '..', '..', 'scripts', 'sync-shared-game.mjs')
    expect(() =>
      execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' }),
    ).not.toThrow()
  })
})
