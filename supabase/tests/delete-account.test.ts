/**
 * Deleting a player's auth user (what the delete-account function does with
 * the service role) must take everything stored about them with it: their
 * profile and every round, verified or not. Other players are untouched.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './db.ts'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

afterAll(async () => {
  await t?.close()
})

async function addRound(userId: string, date: string, darts: number, verified: boolean) {
  const inputs = JSON.stringify(Array.from({ length: darts }, () => ({ lockX: 1, lockY: 2 })))
  await t.asCommit(
    { role: 'service_role' },
    `insert into public.rounds (user_id, puzzle_date, inputs, total_darts, per_target, verified)
     values ($1, $2, $3, $4, '[{},{},{}]', $5)`,
    [userId, date, inputs, darts, verified],
  )
}

const count = async (sql: string, params: unknown[]) =>
  (await t.db.query<{ n: number }>(sql, params)).rows[0].n

describe('deleting an account', () => {
  it('removes the profile and every round, and leaves other players alone', async () => {
    const leaving = await t.newUser()
    const staying = await t.newUser(true)
    await t.asCommit({ role: 'authenticated', id: leaving }, "select public.set_username('Leaver')")
    await addRound(leaving, '2026-11-01', 9, true)
    await addRound(leaving, '2026-11-02', 12, true)
    await addRound(leaving, '2026-11-03', 15, false)
    await addRound(staying, '2026-11-01', 10, true)

    await t.db.query('delete from auth.users where id = $1', [leaving])

    expect(
      await count('select count(*)::int as n from public.profiles where id = $1', [leaving]),
    ).toBe(0)
    expect(
      await count('select count(*)::int as n from public.rounds where user_id = $1', [leaving]),
    ).toBe(0)
    expect(
      await count('select count(*)::int as n from public.rounds where user_id = $1', [staying]),
    ).toBe(1)

    // Gone from the leaderboard straight away, and the username is free again.
    const { rows } = await t.as<{ board: { players: number; top: { display_name: string }[] } }>(
      { role: 'anon' },
      `select public.get_leaderboard('2026-11-01') as board`,
    )
    expect(rows[0].board.players).toBe(1)
    expect(rows[0].board.top.map((e) => e.display_name)).not.toContain('Leaver')
    const newcomer = await t.newUser()
    const renamed = await t.as<{ name: string }>(
      { role: 'authenticated', id: newcomer },
      "select public.set_username('Leaver') as name",
    )
    expect(renamed.rows[0]).toEqual({ name: 'Leaver' })
  })
})
