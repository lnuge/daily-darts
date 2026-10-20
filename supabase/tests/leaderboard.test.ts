import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb, type Who } from './db.ts'

type Row = {
  rank: number
  display_name: string
  total_darts: number
  finished_at: string
  is_me: boolean
}
type Leaderboard = {
  date: string
  players: number
  average_darts: number | null
  top: Row[]
  me: Omit<Row, 'is_me'> | null
}

const DAY = '2026-11-01'
const PER_TARGET = JSON.stringify([
  { target: 55, darts: 2, outcome: 'checkout' },
  { target: 101, darts: 2, outcome: 'checkout' },
  { target: 152, darts: 3, outcome: 'checkout' },
])

let t: TestDb

/** A player with a chosen display name. */
async function player(name: string): Promise<string> {
  const id = await t.newUser()
  await t.db.query('update public.profiles set display_name = $1 where id = $2', [name, id])
  return id
}

/** A round as the server would save it. */
async function round(
  userId: string,
  date: string,
  darts: number,
  finishedAt: string,
  verified = true,
) {
  const inputs = JSON.stringify(Array.from({ length: darts }, (_, i) => ({ lockX: i, lockY: i })))
  await t.asCommit(
    { role: 'service_role' },
    `insert into public.rounds (user_id, puzzle_date, inputs, total_darts, per_target, verified, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, date, inputs, darts, PER_TARGET, verified, finishedAt],
  )
}

async function leaderboard(who: Who, date = DAY, limit?: number): Promise<Leaderboard> {
  const sql =
    limit === undefined
      ? 'select public.get_leaderboard($1::date) as lb'
      : 'select public.get_leaderboard($1::date, $2) as lb'
  const { rows } = await t.as<{ lb: Leaderboard }>(
    who,
    sql,
    limit === undefined ? [date] : [date, limit],
  )
  return rows[0].lb
}

/** What the ranking should be, worked out independently in JavaScript. */
const expected: { name: string; darts: number; at: string }[] = []

let me: string // ranks 104th of 105
let leader: string
let stranger: string // played another day only
let pending: string // has only an unverified round today

beforeAll(async () => {
  t = await createTestDb()

  // 105 verified players. Darts repeat every 19 players, so there are plenty of
  // ties on darts, broken by finish time, including one across the 100/101 cut-off.
  for (let i = 0; i < 105; i++) {
    const name = `P${String(i).padStart(3, '0')}`
    const darts = 7 + ((i * 7) % 19)
    const at = new Date(Date.UTC(2026, 10, 1, 8, 0, 0) + ((i * 37) % 105) * 60_000).toISOString()
    const id = await player(name)
    await round(id, DAY, darts, at)
    expected.push({ name, darts, at })
  }
  expected.sort((a, b) => a.darts - b.darts || a.at.localeCompare(b.at))
  const meName = expected[103].name
  me = (
    await t.db.query<{ id: string }>('select id from public.profiles where display_name = $1', [
      meName,
    ])
  ).rows[0].id
  leader = (
    await t.db.query<{ id: string }>('select id from public.profiles where display_name = $1', [
      expected[0].name,
    ])
  ).rows[0].id

  // Noise that must not count: another day, and an unverified round today.
  stranger = await player('Stranger')
  await round(stranger, '2026-10-31', 3, '2026-10-31T09:00:00Z')
  pending = await player('Pending')
  await round(pending, DAY, 3, '2026-11-01T07:00:00Z', false)
})

afterAll(async () => {
  await t?.close()
})

describe('get_leaderboard', () => {
  it('has test data with a tie on darts across the top-100 cut-off', () => {
    // Otherwise a wrong tie-break could pick the wrong players for the top 100 unnoticed.
    expect(expected[99].darts).toBe(expected[100].darts)
  })

  it('lists the top 100 by fewest darts, ties broken by earliest finish', async () => {
    const lb = await leaderboard({ role: 'anon' })
    expect(lb.top).toHaveLength(100)
    expect(lb.top.map((r) => r.display_name)).toEqual(expected.slice(0, 100).map((e) => e.name))
    expect(lb.top.map((r) => r.rank)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
    for (let i = 1; i < lb.top.length; i++) {
      const [a, b] = [lb.top[i - 1], lb.top[i]]
      expect(
        a.total_darts < b.total_darts ||
          (a.total_darts === b.total_darts && a.finished_at <= b.finished_at),
      ).toBe(true)
    }
  })

  it('counts players and averages darts over verified rounds for that day only', async () => {
    const lb = await leaderboard({ role: 'anon' })
    expect(lb.players).toBe(105)
    const average = expected.reduce((sum, e) => sum + e.darts, 0) / expected.length
    expect(lb.average_darts).toBe(Math.round(average * 10) / 10)
  })

  it("gives the player their own rank when they're outside the top 100", async () => {
    const lb = await leaderboard({ role: 'authenticated', id: me })
    expect(lb.me).toMatchObject({
      rank: 104,
      display_name: expected[103].name,
      total_darts: expected[103].darts,
    })
    expect(lb.top.some((r) => r.is_me)).toBe(false)
  })

  it("marks the player's own row when they are in the top 100", async () => {
    const lb = await leaderboard({ role: 'authenticated', id: leader })
    expect(lb.me?.rank).toBe(1)
    expect(lb.top.filter((r) => r.is_me).map((r) => r.rank)).toEqual([1])
  })

  it('has no "me" for visitors, players who did not play that day, or unverified rounds', async () => {
    expect((await leaderboard({ role: 'anon' })).me).toBeNull()
    expect((await leaderboard({ role: 'authenticated', id: stranger })).me).toBeNull()
    expect((await leaderboard({ role: 'authenticated', id: pending })).me).toBeNull()
    expect(
      (await leaderboard({ role: 'anon' })).top.some((r) => r.display_name === 'Pending'),
    ).toBe(false)
  })

  it('shows any past date', async () => {
    const lb = await leaderboard({ role: 'authenticated', id: stranger }, '2026-10-31')
    expect(lb).toMatchObject({ date: '2026-10-31', players: 1, average_darts: 3 })
    expect(lb.top).toEqual([
      expect.objectContaining({ rank: 1, display_name: 'Stranger', is_me: true }),
    ])
    expect(lb.me?.rank).toBe(1)
  })

  it('handles a day nobody has played', async () => {
    expect(await leaderboard({ role: 'anon' }, '2026-12-25')).toEqual({
      date: '2026-12-25',
      players: 0,
      average_darts: null,
      top: [],
      me: null,
    })
  })

  it('gives every player a unique rank, even with identical darts and finish times', async () => {
    const [a, b] = [await player('TwinA'), await player('TwinB')]
    await round(a, '2026-11-05', 9, '2026-11-05T10:00:00Z')
    await round(b, '2026-11-05', 9, '2026-11-05T10:00:00Z')
    const lb = await leaderboard({ role: 'anon' }, '2026-11-05')
    expect(lb.top.map((r) => r.rank)).toEqual([1, 2])
    const asA = await leaderboard({ role: 'authenticated', id: a }, '2026-11-05')
    const asB = await leaderboard({ role: 'authenticated', id: b }, '2026-11-05')
    expect([asA.me?.rank, asB.me?.rank].sort()).toEqual([1, 2])
  })

  it('caps the list at 100 whatever limit is asked for', async () => {
    expect((await leaderboard({ role: 'anon' }, DAY, 5)).top).toHaveLength(5)
    expect((await leaderboard({ role: 'anon' }, DAY, 100000)).top).toHaveLength(100)
  })

  it('never exposes throw inputs or user ids', async () => {
    const text = JSON.stringify(await leaderboard({ role: 'authenticated', id: me }))
    expect(text).not.toContain('inputs')
    expect(text).not.toContain('lockX')
    expect(text).not.toContain(me)
  })
})
