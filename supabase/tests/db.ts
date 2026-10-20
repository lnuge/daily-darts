/**
 * A real Postgres (PGlite, in-process) with the Supabase pieces our migrations
 * rely on stubbed in, and every migration applied. Lets tests act as a
 * signed-out visitor, a signed-in player or the server, the way PostgREST would.
 * No Supabase project or Docker needed.
 */

import { PGlite, type Transaction } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')

/** The parts of a Supabase database the migrations depend on. */
export const SUPABASE_STUB = `
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

export type Who =
  { role: 'anon' } | { role: 'authenticated'; id: string } | { role: 'service_role' }

async function become(tx: Transaction, who: Who) {
  const claims = who.role === 'authenticated' ? { sub: who.id, role: who.role } : { role: who.role }
  await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
  await tx.exec(`set local role ${who.role}`)
}

export async function createTestDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }

  return {
    db,

    /** Runs `sql` as the given user in a transaction that's rolled back afterwards. */
    as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) {
      return db.transaction(async (tx) => {
        await become(tx, who)
        const result = await tx.query<T>(sql, params)
        await tx.rollback()
        return result
      })
    },

    /** Like `as`, but commits. */
    asCommit<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) {
      return db.transaction(async (tx) => {
        await become(tx, who)
        return tx.query<T>(sql, params)
      })
    },

    /** A new auth user (which also gets a profile, via the migration's trigger). */
    async newUser(isAnonymous = false): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        'insert into auth.users (is_anonymous) values ($1) returning id',
        [isAnonymous],
      )
      return rows[0].id
    },

    close: () => db.close(),
  }
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>
