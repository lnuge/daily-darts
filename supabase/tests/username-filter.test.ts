/**
 * The username swear-word filter (20261025090000_username_filter.sql): what it
 * catches, the ordinary names it must leave alone, and how set_username uses it.
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

const blocked = async (name: string) =>
  (
    await t.db.query<{ blocked: boolean }>('select public.username_is_blocked($1) as blocked', [
      name,
    ])
  ).rows[0].blocked

describe('username_is_blocked', () => {
  it.each([
    'fuck',
    'FUCK',
    'FuckYou',
    'xxfuckxx',
    'f_u_c_k',
    'fuuuuuck',
    'phuckfuck',
    'sh1t',
    'Sh1tHead',
    '5hit',
    'b1tch',
    'b_i_t_c_h_99',
    'cocksucker',
    'motherfucker',
    'pussycat',
  ])('blocks %j (a word blocked anywhere)', async (name) => {
    expect(await blocked(name)).toBe(true)
  })

  it.each([
    'ass',
    'Ass',
    'asssss',
    'big_ass',
    'BigAss',
    'ASS_hat',
    'ass99',
    '99_ass',
    'a55',
    'Tits_McGee',
    'cum_laude',
    'Dick_Turpin',
    'wank',
    'kkk',
    'KKKK_fan',
  ])('blocks %j (a whole word)', async (name) => {
    expect(await blocked(name)).toBe(true)
  })

  it.each([
    'Alice_99',
    'Treble_Tom',
    'Bob',
    'bobby',
    'Classy',
    'class_act',
    'Bass_Player',
    'assassin',
    'Passion',
    'Cockburn',
    'Peacock',
    'Hancock',
    'Cockpit',
    'Dickens',
    'Dickinson',
    'scrapper',
    'Grape_Ape',
    'therapist',
    'Swanky',
    'Essex_Darts',
    'Sussex',
    'Arsenal_Fan',
    'title_run',
    'cucumber',
    'Raccoon',
    'cocoon',
    'Analyst',
    'canal_boat',
    'Montenegro',
    'NigeriaFan',
    'Niger',
    'Spice_Boy',
    'Pedometer',
    'Hoedown',
    'Shoelace',
    'Pistol_Pete',
    'Hello',
    'Kirkby',
    'Pisa_Tower',
    'Kakkoii',
  ])('allows %j', async (name) => {
    expect(await blocked(name)).toBe(false)
  })

  it('uses words added to the table later', async () => {
    expect(await blocked('Darn_It')).toBe(false)
    await t.db.query(`insert into public.username_blocklist values ('darn', false)`)
    expect(await blocked('Darn_It')).toBe(true)
    expect(await blocked('Darnell')).toBe(false)
    await t.db.query(`delete from public.username_blocklist where word = 'darn'`)
  })

  it('only takes lower-case letters in the table', async () => {
    await expect(
      t.db.query(`insert into public.username_blocklist values ('Bad Word', true)`),
    ).rejects.toThrow(/username_blocklist_word_format/)
  })
})

describe('set_username with the filter', () => {
  it('refuses blocked names as not allowed, and still accepts ordinary ones', async () => {
    const id = await t.newUser(true)
    const setName = (name: string) =>
      t.as({ role: 'authenticated', id }, 'select public.set_username($1) as name', [name])
    await expect(setName('BigAss')).rejects.toThrow(/username_reserved/)
    await expect(setName('sh1t_darts')).rejects.toThrow(/username_reserved/)
    expect((await setName('Classy_Darts')).rows[0]).toEqual({ name: 'Classy_Darts' })
  })

  it('hides the word list from players and visitors', async () => {
    for (const who of [
      { role: 'anon' as const },
      { role: 'authenticated' as const, id: await t.newUser() },
    ]) {
      await expect(t.as(who, 'select * from public.username_blocklist')).rejects.toThrow(
        /permission denied/,
      )
      await expect(t.as(who, "select public.username_is_blocked('x')")).rejects.toThrow(
        /permission denied/,
      )
    }
  })
})
