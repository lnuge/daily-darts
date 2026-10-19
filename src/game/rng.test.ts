import { describe, expect, it } from 'vitest'
import { createRng, hashString, seedFromDateKey } from './rng'

describe('hashString', () => {
  it('matches known FNV-1a values', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('a')).toBe(0xe40c292c)
  })
})

describe('seedFromDateKey', () => {
  it('gives the same seed for the same date', () => {
    expect(seedFromDateKey('2026-10-19')).toBe(seedFromDateKey('2026-10-19'))
  })

  it('gives different seeds for different dates', () => {
    expect(seedFromDateKey('2026-10-19')).not.toBe(seedFromDateKey('2026-10-20'))
  })

  it('rejects malformed keys', () => {
    expect(() => seedFromDateKey('10/19/2026')).toThrow()
  })
})

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces a pinned sequence, so engine or refactor drift is caught', () => {
    const rng = createRng(1)
    const ints = Array.from({ length: 5 }, () => rng.int(0, 1_000_000))
    expect(ints).toMatchInlineSnapshot(`
      [
        627074,
        2735,
        527447,
        981051,
        968378,
      ]
    `)
  })

  it('keeps next() in [0, 1) and int() in range', () => {
    const rng = createRng(seedFromDateKey('2026-10-19'))
    for (let i = 0; i < 10_000; i++) {
      const f = rng.next()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const n = rng.int(1, 20)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(20)
    }
  })

  it('can resume from a saved state', () => {
    const rng = createRng(7)
    rng.next()
    rng.next()
    const resumed = createRng(rng.state())
    expect(resumed.next()).toBe(rng.next())
  })
})
