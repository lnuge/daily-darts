/**
 * Runs the migrations in real Postgres (PGlite, in-process) on top of a stub of
 * the Supabase pieces they rely on, then checks what each kind of user can
 * and can't do. No Supabase project or Docker needed.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { usernameProblem } from '../../src/lib/username.ts'
import { createTestDb, type TestDb, type Who } from './db.ts'

let t: TestDb
const as = <T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) =>
  t.as<T>(who, sql, params)
const asCommit = (who: Who, sql: string, params: unknown[] = []) => t.asCommit(who, sql, params)
const newUser = (isAnonymous = false) => t.newUser(isAnonymous)

beforeAll(async () => {
  t = await createTestDb()
})

afterAll(async () => {
  await t?.close()
})

const PER_TARGET = JSON.stringify([
  { target: 55, darts: 2, outcome: 'checkout' },
  { target: 101, darts: 2, outcome: 'checkout' },
  { target: 152, darts: 3, outcome: 'checkout' },
])
const INPUTS = JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ lockX: i, lockY: i + 1 })))

/**
 * No RETURNING clause: with one, Postgres also applies the SELECT policies to
 * the new row, which would mask whether the INSERT policy itself is right.
 * (The Supabase client inserts without returning rows by default, too.)
 */
const insertRound = (userId: string, date = '2026-11-01', extraCols = '', extraVals = '') => `
  insert into public.rounds (user_id, puzzle_date, inputs, total_darts, per_target${extraCols})
  values ('${userId}', '${date}', '${INPUTS}', 7, '${PER_TARGET}'${extraVals})`

let alice: string
let bob: string
let guest: string

beforeAll(async () => {
  alice = await newUser()
  bob = await newUser()
  guest = await newUser(true)
  // Bob has a verified round (as the server would write it) and an unverified one.
  await asCommit({ role: 'service_role' }, insertRound(bob, '2026-11-01', ', verified', ', true'))
  await asCommit({ role: 'authenticated', id: bob }, insertRound(bob, '2026-11-02'))
})

describe('profiles', () => {
  it('are created automatically with a neutral name for every new user', async () => {
    const { rows } = await t.db.query<{ id: string; display_name: string }>(
      'select id, display_name from public.profiles where id = $1',
      [guest],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].display_name).toMatch(/^Player [0-9A-F]{6}$/)
  })

  it('are readable by everyone, signed in or not', async () => {
    const { rows } = await as({ role: 'anon' }, 'select count(*)::int as n from public.profiles')
    expect(rows[0]).toEqual({ n: 3 })
  })

  it("can't be updated directly by players (only through set_username)", async () => {
    await expect(
      as(
        { role: 'authenticated', id: alice },
        `update public.profiles set display_name = 'Alice' where id = '${alice}'`,
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(
        { role: 'authenticated', id: alice },
        `update public.profiles set created_at = now() - interval '1 year' where id = '${alice}'`,
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('reject blank, padded, very long or badly formed names, even from the server', async () => {
    for (const name of ['', '  Alice', 'x'.repeat(25), 'two words', 'Bob!', 'Player 3f9a1c']) {
      await expect(
        as(
          { role: 'service_role' },
          `update public.profiles set display_name = $1 where id = '${alice}'`,
          [name],
        ),
      ).rejects.toThrow(/profiles_display_name/)
    }
  })

  it("don't require generated names to be unique", async () => {
    const { affectedRows } = await as(
      { role: 'service_role' },
      `update public.profiles set display_name = 'Player 000000' where id in ('${alice}', '${bob}')`,
    )
    expect(affectedRows).toBe(2)
  })

  it("can't be edited by signed-out visitors", async () => {
    await expect(
      as({ role: 'anon' }, `update public.profiles set display_name = 'x' where id = '${bob}'`),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('set_username', () => {
  const setName = (id: string, name: unknown) =>
    as<{ name: string }>({ role: 'authenticated', id }, 'select public.set_username($1) as name', [
      name,
    ])
  const nameOf = async (id: string) =>
    (
      await t.db.query<{ display_name: string }>(
        'select display_name from public.profiles where id = $1',
        [id],
      )
    ).rows[0].display_name

  it("sets the caller's own name, trimmed, and returns it", async () => {
    const { rows } = await asCommit(
      { role: 'authenticated', id: alice },
      'select public.set_username($1) as name',
      ['  Alice_99 '],
    )
    expect(rows[0]).toEqual({ name: 'Alice_99' })
    expect(await nameOf(alice)).toBe('Alice_99')
    expect(await nameOf(bob)).toMatch(/^Player [0-9A-F]{6}$/)
  })

  it('lets guests choose a username too', async () => {
    const { rows } = await setName(guest, 'GuestStar')
    expect(rows[0]).toEqual({ name: 'GuestStar' })
  })

  it('is unique ignoring case', async () => {
    for (const name of ['Alice_99', 'alice_99', 'ALICE_99']) {
      await expect(setName(bob, name)).rejects.toThrow(/username_taken/)
    }
    // The owner can change the case of their own name.
    const { rows } = await setName(alice, 'ALICE_99')
    expect(rows[0]).toEqual({ name: 'ALICE_99' })
  })

  it('rejects names that are too short, too long or have other characters', async () => {
    for (const name of [
      '',
      'ab',
      'x'.repeat(21),
      'two words',
      'bob!',
      'bob-smith',
      'Álvaro',
      'b0b\u0430',
      '😀😀😀',
      null,
    ]) {
      await expect(setName(bob, name)).rejects.toThrow(/username_invalid/)
    }
  })

  it('accepts names at the length limits', async () => {
    expect((await setName(bob, 'abc')).rows[0]).toEqual({ name: 'abc' })
    expect((await setName(bob, 'x'.repeat(20))).rows[0]).toEqual({ name: 'x'.repeat(20) })
  })

  it("agrees with the app's own check on what's a valid username", async () => {
    for (const name of ['ab', 'abc', 'x'.repeat(20), 'x'.repeat(21), ' Pad_1 ', 'a b c', 'a.b.c']) {
      const appOk = usernameProblem(name) === null
      const serverOk = await setName(bob, name).then(
        () => true,
        (e: Error) => !/username_invalid/.test(e.message),
      )
      expect(serverOk, name).toBe(appOk)
    }
  })

  it('rejects names that pass for the game, staff or a generated name', async () => {
    for (const name of [
      'admin',
      'Moderator',
      'DailyDarts',
      'the_dailydarts_team',
      'Daily_Darts_HQ',
      'Player',
      'Player_3F9A1C',
      'player3f9a1c',
    ]) {
      await expect(setName(bob, name)).rejects.toThrow(/username_reserved/)
    }
    // Only the exact generated pattern is reserved, not every name starting "player".
    expect((await setName(bob, 'PlayerOne')).rows[0]).toEqual({ name: 'PlayerOne' })
  })

  it("can't be called by signed-out visitors", async () => {
    await expect(as({ role: 'anon' }, "select public.set_username('Sneaky')")).rejects.toThrow(
      /permission denied/,
    )
  })

  it('shows the new name on the leaderboard', async () => {
    await asCommit({ role: 'authenticated', id: bob }, "select public.set_username('Bobby')")
    const { rows } = await as<{ board: { top: { display_name: string }[] } }>(
      { role: 'anon' },
      `select public.get_leaderboard('2026-11-01') as board`,
    )
    expect(rows[0].board.top.map((e) => e.display_name)).toEqual(['Bobby'])
  })
})

describe('rounds: reading', () => {
  it('shows only verified rounds to signed-out visitors', async () => {
    const { rows } = await as<{ puzzle_date: string; verified: boolean }>(
      { role: 'anon' },
      'select puzzle_date::text, verified from public.rounds',
    )
    expect(rows).toEqual([{ puzzle_date: '2026-11-01', verified: true }])
  })

  it("shows a player their own unverified rounds, but not other people's", async () => {
    const own = await as({ role: 'authenticated', id: bob }, 'select verified from public.rounds')
    expect(own.rows).toHaveLength(2)
    const other = await as(
      { role: 'authenticated', id: alice },
      'select verified from public.rounds',
    )
    expect(other.rows).toEqual([{ verified: true }])
  })
})

describe('rounds: throw inputs', () => {
  it("are hidden from everyone but the server, so nobody can copy a top round's throws", async () => {
    for (const who of [{ role: 'anon' }, { role: 'authenticated', id: alice }] as const) {
      await expect(as(who, 'select inputs from public.rounds')).rejects.toThrow(/permission denied/)
      await expect(as(who, 'select * from public.rounds')).rejects.toThrow(/permission denied/)
    }
    // Not even your own: the client never needs them back.
    await expect(
      as(
        { role: 'authenticated', id: bob },
        `select inputs from public.rounds where user_id = '${bob}'`,
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('leave every other column readable', async () => {
    const { rows } = await as(
      { role: 'anon' },
      'select id, user_id, puzzle_date, total_darts, per_target, verified, created_at from public.rounds',
    )
    expect(rows).toHaveLength(1)
  })

  it('are readable by the server, to replay rounds', async () => {
    const { rows } = await as({ role: 'service_role' }, 'select inputs from public.rounds')
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('rounds: inserting', () => {
  it('lets a signed-in player insert their own round, unverified', async () => {
    const { rows } = await as<{ verified: boolean }>(
      { role: 'authenticated', id: alice },
      insertRound(alice) + ' returning verified',
    )
    expect(rows).toEqual([{ verified: false }])
  })

  it('lets an anonymous guest insert their own round', async () => {
    const { affectedRows } = await as({ role: 'authenticated', id: guest }, insertRound(guest))
    expect(affectedRows).toBe(1)
  })

  it("won't let a player insert a round for someone else", async () => {
    await expect(
      as({ role: 'authenticated', id: alice }, insertRound(bob, '2026-11-05')),
    ).rejects.toThrow(/row-level security/)
  })

  it("won't let a player mark their own round verified", async () => {
    await expect(
      as(
        { role: 'authenticated', id: alice },
        insertRound(alice, '2026-11-01', ', verified', ', true'),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it("won't let a player backdate a round to win a tie-break", async () => {
    await expect(
      as(
        { role: 'authenticated', id: alice },
        insertRound(alice, '2026-11-01', ', created_at', ", '2026-11-01 00:00:01+00'"),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it("won't let signed-out visitors insert anything", async () => {
    await expect(as({ role: 'anon' }, insertRound(alice))).rejects.toThrow(/permission denied/)
  })

  it('allows only one round per player per day', async () => {
    await expect(
      as({ role: 'authenticated', id: bob }, insertRound(bob, '2026-11-02')),
    ).rejects.toThrow(/rounds_one_per_player_per_day/)
  })

  it('rejects rounds whose dart count does not match the inputs', async () => {
    await expect(
      as(
        { role: 'authenticated', id: alice },
        `insert into public.rounds (user_id, puzzle_date, inputs, total_darts, per_target)
         values ('${alice}', '2026-11-03', '${INPUTS}', 3, '${PER_TARGET}')`,
      ),
    ).rejects.toThrow(/rounds_inputs_match_darts/)
  })
})

describe('rounds: changing', () => {
  it("won't let a player update or delete rounds, even their own", async () => {
    const who = { role: 'authenticated', id: bob } as const
    await expect(
      as(who, `update public.rounds set total_darts = 3 where user_id = '${bob}'`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(who, `update public.rounds set verified = true where user_id = '${bob}'`),
    ).rejects.toThrow(/permission denied/)
    await expect(as(who, `delete from public.rounds where user_id = '${bob}'`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('lets the server (service role) verify a round', async () => {
    const { affectedRows } = await as(
      { role: 'service_role' },
      `update public.rounds set verified = true where user_id = '${bob}' and puzzle_date = '2026-11-02'`,
    )
    expect(affectedRows).toBe(1)
  })
})

describe('accounts', () => {
  it("remove a player's profile and rounds when the account is deleted", async () => {
    await t.db.transaction(async (tx) => {
      await tx.query('delete from auth.users where id = $1', [bob])
      const profiles = await tx.query('select 1 from public.profiles where id = $1', [bob])
      const rounds = await tx.query('select 1 from public.rounds where user_id = $1', [bob])
      expect(profiles.rows).toHaveLength(0)
      expect(rounds.rows).toHaveLength(0)
      await tx.rollback()
    })
  })
})
