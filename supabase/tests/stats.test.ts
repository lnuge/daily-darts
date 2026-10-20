import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findCheckout } from '../../src/game/checkout.ts'
import { addDays } from '../../src/game/date.ts'
import { createTestDb, type TestDb, type Who } from './db.ts'

type Stats = {
  rounds_played: number
  current_streak: number
  best_streak: number
  average_darts: number | null
  best_round: { total_darts: number; puzzle_date: string } | null
  perfect_checkouts: number
  last_played: string | null
}

// Real "today" (UTC), which is always one of the dates that are today somewhere on Earth.
const TODAY = new Date().toISOString().slice(0, 10)
const day = (offset: number) => addDays(TODAY, offset)

type Target = { target: number; darts: number; outcome: 'checkout' | 'capped' }
// Three ordinary targets, none finished in the minimum: 101 (min 2) in 6, 60 (min 2) in 5, 121 (min 3) in 9.
const ORDINARY: Target[] = [
  { target: 101, darts: 6, outcome: 'checkout' },
  { target: 60, darts: 5, outcome: 'checkout' },
  { target: 121, darts: 9, outcome: 'checkout' },
]

let t: TestDb

async function round(userId: string, date: string, targets = ORDINARY, verified = true) {
  const total = targets.reduce((sum, x) => sum + x.darts, 0)
  const inputs = JSON.stringify(Array.from({ length: total }, () => ({ lockX: 1, lockY: 2 })))
  await t.asCommit(
    { role: 'service_role' },
    `insert into public.rounds (user_id, puzzle_date, inputs, total_darts, per_target, verified)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, date, inputs, total, JSON.stringify(targets), verified],
  )
}

async function stats(who: Who, today: string | null = TODAY): Promise<Stats> {
  const { rows } = await t.as<{ s: Stats }>(
    who,
    today === null
      ? 'select public.get_player_stats() as s'
      : 'select public.get_player_stats($1::date) as s',
    today === null ? [] : [today],
  )
  return rows[0].s
}

const as = (id: string) => ({ role: 'authenticated', id }) as const

beforeAll(async () => {
  t = await createTestDb()
})

afterAll(async () => {
  await t?.close()
})

describe('checkout_min_darts', () => {
  it("matches the game's checkout solver for every score", async () => {
    const { rows } = await t.db.query<{ score: number; darts: number }>(
      'select score, darts from public.checkout_min_darts order by score',
    )
    const expected = []
    for (let score = 0; score <= 200; score++) {
      const route = findCheckout(score)
      if (route) expected.push({ score, darts: route.length })
    }
    expect(rows).toEqual(expected)
    expect(rows.map((r) => r.score)).not.toContain(159) // bogey numbers are absent
  })
})

describe('get_player_stats: streaks', () => {
  it('counts the current streak through yesterday and the best streak overall', async () => {
    const id = await t.newUser()
    for (let d = -12; d <= -7; d++) await round(id, day(d)) // 6 days
    for (let d = -5; d <= -1; d++) await round(id, day(d)) // 5 days, up to yesterday
    expect(await stats(as(id))).toMatchObject({
      current_streak: 5,
      best_streak: 6,
      rounds_played: 11,
    })
  })

  it('includes today once it has been played', async () => {
    const id = await t.newUser()
    for (let d = -2; d <= 0; d++) await round(id, day(d))
    expect(await stats(as(id))).toMatchObject({
      current_streak: 3,
      best_streak: 3,
      last_played: TODAY,
    })
  })

  it('drops the current streak to 0 after a missed day', async () => {
    const id = await t.newUser()
    for (let d = -6; d <= -2; d++) await round(id, day(d)) // last played two days ago
    expect(await stats(as(id))).toMatchObject({ current_streak: 0, best_streak: 5 })
  })

  it("can't revive a broken streak by claiming an old date as today", async () => {
    const id = await t.newUser()
    for (let d = -6; d <= -3; d++) await round(id, day(d))
    expect((await stats(as(id), day(-3))).current_streak).toBe(0)
    expect((await stats(as(id), '2020-01-01')).current_streak).toBe(0)
    expect((await stats(as(id), null)).current_streak).toBe(0)
  })

  it('counts only verified rounds', async () => {
    const id = await t.newUser()
    await round(id, day(-2))
    await round(id, day(-1), ORDINARY, false) // unverified: doesn't bridge the gap
    await round(id, day(0))
    expect(await stats(as(id))).toMatchObject({
      current_streak: 1,
      best_streak: 1,
      rounds_played: 2,
    })
  })

  it("counts only the caller's own rounds", async () => {
    const [me, other] = [await t.newUser(), await t.newUser()]
    await round(me, day(-1))
    await round(other, day(0))
    expect(await stats(as(me))).toMatchObject({
      current_streak: 1,
      rounds_played: 1,
      last_played: day(-1),
    })
  })
})

describe('get_player_stats: rounds', () => {
  it('reports average darts, best round and perfect checkouts', async () => {
    const id = await t.newUser()
    // 55 (min 2) in 2, 101 (min 2) in 2, 170 (min 3) in 3: three perfect checkouts, 7 darts.
    await round(id, day(-3), [
      { target: 55, darts: 2, outcome: 'checkout' },
      { target: 101, darts: 2, outcome: 'checkout' },
      { target: 170, darts: 3, outcome: 'checkout' },
    ])
    // 40 (min 1) in 1: perfect. 92 (min 2) in 4: not. 121 capped at 30: never perfect.
    await round(id, day(-2), [
      { target: 40, darts: 1, outcome: 'checkout' },
      { target: 92, darts: 4, outcome: 'checkout' },
      { target: 121, darts: 30, outcome: 'capped' },
    ])
    // Another 7-dart round, later: the earlier one stays the best.
    await round(id, day(-1), [
      { target: 60, darts: 2, outcome: 'checkout' },
      { target: 100, darts: 2, outcome: 'checkout' },
      { target: 130, darts: 3, outcome: 'checkout' },
    ])
    const s = await stats(as(id))
    expect(s.rounds_played).toBe(3)
    expect(s.average_darts).toBe(Math.round(((7 + 35 + 7) / 3) * 10) / 10)
    expect(s.best_round).toEqual({ total_darts: 7, puzzle_date: day(-3) })
    // 55, 101, 170, 40 from the first two rounds; 60 (S20 D20), 100 (T20 D20) and 130 (T20 T20 D5) too.
    expect(s.perfect_checkouts).toBe(7)
  })

  it('is empty for someone who has not played, and for signed-out visitors', async () => {
    const empty = {
      rounds_played: 0,
      current_streak: 0,
      best_streak: 0,
      average_darts: null,
      best_round: null,
      perfect_checkouts: 0,
      last_played: null,
    }
    expect(await stats(as(await t.newUser()))).toEqual(empty)
    expect(await stats({ role: 'anon' })).toEqual(empty)
  })
})
