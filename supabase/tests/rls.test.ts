/**
 * Runs the migrations in real Postgres (PGlite, in-process) on top of a stub of
 * the Supabase pieces they rely on, then checks what each kind of user can
 * and can't do. No Supabase project or Docker needed.
 */

import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')

/** The parts of a Supabase database the migrations depend on. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    is_anonymous boolean not null default false
  );
  -- Same definition as Supabase: the signed-in user's id from the request JWT.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  -- Supabase grants everything on new public tables to these roles; RLS does the rest.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
})

afterAll(async () => {
  await db?.close()
})

type Who = { role: 'anon' } | { role: 'authenticated'; id: string } | { role: 'service_role' }

/** Runs `sql` as the given user, the way PostgREST would, in a rolled-back transaction. */
async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    const claims =
      who.role === 'authenticated' ? { sub: who.id, role: who.role } : { role: who.role }
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    await tx.exec(`set local role ${who.role}`)
    const result = await tx.query<T>(sql, params)
    await tx.rollback()
    return result
  })
}

/** Like `as`, but commits. */
async function asCommit(who: Who, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    const claims =
      who.role === 'authenticated' ? { sub: who.id, role: who.role } : { role: who.role }
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    await tx.exec(`set local role ${who.role}`)
    return tx.query(sql, params)
  })
}

async function newUser(isAnonymous = false): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (is_anonymous) values ($1) returning id',
    [isAnonymous],
  )
  return rows[0].id
}

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
    const { rows } = await db.query<{ id: string; display_name: string }>(
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

  it('let a player change their own display name', async () => {
    const { affectedRows } = await as(
      { role: 'authenticated', id: alice },
      `update public.profiles set display_name = 'Alice' where id = '${alice}'`,
    )
    expect(affectedRows).toBe(1)
  })

  it("don't let a player change someone else's name", async () => {
    const { affectedRows } = await as(
      { role: 'authenticated', id: alice },
      `update public.profiles set display_name = 'Hacked' where id = '${bob}'`,
    )
    expect(affectedRows).toBe(0)
  })

  it('only let players change the display name column', async () => {
    await expect(
      as(
        { role: 'authenticated', id: alice },
        `update public.profiles set created_at = now() - interval '1 year' where id = '${alice}'`,
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('reject blank, padded or very long names', async () => {
    for (const name of ['', '  Alice', 'x'.repeat(25)]) {
      await expect(
        as(
          { role: 'authenticated', id: alice },
          `update public.profiles set display_name = $1 where id = '${alice}'`,
          [name],
        ),
      ).rejects.toThrow(/profiles_display_name/)
    }
  })

  it("can't be edited by signed-out visitors", async () => {
    await expect(
      as({ role: 'anon' }, `update public.profiles set display_name = 'x' where id = '${bob}'`),
    ).rejects.toThrow(/permission denied/)
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
    await db.transaction(async (tx) => {
      await tx.query('delete from auth.users where id = $1', [bob])
      const profiles = await tx.query('select 1 from public.profiles where id = $1', [bob])
      const rounds = await tx.query('select 1 from public.rounds where user_id = $1', [bob])
      expect(profiles.rows).toHaveLength(0)
      expect(rounds.rows).toHaveLength(0)
      await tx.rollback()
    })
  })
})
