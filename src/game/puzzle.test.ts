import { describe, expect, it } from 'vitest'
import { findCheckout } from './checkout.ts'
import { addDays } from './date.ts'
import {
  LAUNCH_DATE,
  SWEEP_SPEED_RANGE,
  TARGET_RANGES,
  WOBBLE_RANGE,
  generateDailyPuzzle,
  getDailySeed,
  type DailyPuzzle,
} from './puzzle.ts'
import { isLegalCheckoutRoute } from './test-helpers.ts'

/** Every date key from `start`, `count` days long. */
function dateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

// Five years from a little before launch, covering two leap days.
const DATES = dateRange('2026-10-01', 5 * 365 + 2)

/** The parts of a puzzle that change gameplay (not its date or number). */
const gameplay = (p: DailyPuzzle) => JSON.stringify([p.targets, p.sweepSpeed, p.wobble])

describe('getDailySeed', () => {
  it('is the same for the same date', () => {
    expect(getDailySeed('2026-11-01')).toBe(getDailySeed('2026-11-01'))
  })

  it('is distinct for every date in the range', () => {
    const seeds = new Set(DATES.map(getDailySeed))
    expect(seeds.size).toBe(DATES.length)
  })

  it('rejects anything that is not a real YYYY-MM-DD date', () => {
    for (const bad of ['', '2026-11-1', '11/01/2026', '2026-02-30', '2026-11-01T00:00:00Z']) {
      expect(() => getDailySeed(bad), bad).toThrow()
    }
  })
})

describe('generateDailyPuzzle', () => {
  it('gives the same puzzle every time for the same date', () => {
    for (const date of DATES) {
      expect(generateDailyPuzzle(date)).toEqual(generateDailyPuzzle(date))
    }
  })

  it('gives exactly this puzzle on launch day', () => {
    // Pinned so any change to seeding or generation is caught: changing it
    // changes every past puzzle and breaks replay of stored rounds.
    expect(generateDailyPuzzle(LAUNCH_DATE)).toMatchInlineSnapshot(`
      {
        "date": "2026-11-01",
        "puzzleNumber": 0,
        "sweepSpeed": 0.83,
        "targets": [
          55,
          101,
          152,
        ],
        "wobble": 0.032,
      }
    `)
  })

  it('gives a different puzzle on every date in the range', () => {
    const seen = new Map<string, string>()
    for (const date of DATES) {
      const key = gameplay(generateDailyPuzzle(date))
      expect(seen.get(key), `${date} repeats ${seen.get(key)}`).toBeUndefined()
      seen.set(key, date)
    }
  })

  it('makes every target a legal double-out checkout in its tier', () => {
    for (const date of DATES) {
      const { targets } = generateDailyPuzzle(date)
      const tiers = [TARGET_RANGES.easy, TARGET_RANGES.medium, TARGET_RANGES.hard]
      targets.forEach((target, i) => {
        const where = `${date} target ${i}: ${target}`
        expect(Number.isInteger(target), where).toBe(true)
        expect(target, where).toBeGreaterThanOrEqual(tiers[i].min)
        expect(target, where).toBeLessThanOrEqual(tiers[i].max)
        const route = findCheckout(target)
        expect(route, where).not.toBeNull()
        expect(isLegalCheckoutRoute(target, route!), where).toBe(true)
      })
    }
  })

  it('never picks a bogey number for the hard target', () => {
    const bogeys = new Set([159, 162, 163, 165, 166, 168, 169])
    for (const date of DATES) {
      expect(bogeys.has(generateDailyPuzzle(date).targets[2]), date).toBe(false)
    }
  })

  it('uses the whole range of each tier over time', () => {
    for (const [i, { min, max }] of [
      TARGET_RANGES.easy,
      TARGET_RANGES.medium,
      TARGET_RANGES.hard,
    ].entries()) {
      const used = new Set(DATES.map((d) => generateDailyPuzzle(d).targets[i]))
      const legalCount = Array.from({ length: max - min + 1 }, (_, k) => min + k).filter(
        (s) => findCheckout(s) !== null,
      ).length
      expect(used.size).toBe(legalCount)
    }
  })

  it('keeps sweep speed and wobble in range and on their decimal grids', () => {
    for (const date of DATES) {
      const { sweepSpeed, wobble } = generateDailyPuzzle(date)
      expect(sweepSpeed).toBeGreaterThanOrEqual(SWEEP_SPEED_RANGE.min)
      expect(sweepSpeed).toBeLessThanOrEqual(SWEEP_SPEED_RANGE.max)
      expect(Math.round(sweepSpeed * 100) / 100).toBe(sweepSpeed)
      expect(wobble).toBeGreaterThanOrEqual(WOBBLE_RANGE.min)
      expect(wobble).toBeLessThanOrEqual(WOBBLE_RANGE.max)
      expect(Math.round(wobble * 1000) / 1000).toBe(wobble)
    }
  })

  it('numbers puzzles by days since launch', () => {
    expect(generateDailyPuzzle('2026-11-01').puzzleNumber).toBe(0)
    expect(generateDailyPuzzle('2026-11-02').puzzleNumber).toBe(1)
    expect(generateDailyPuzzle('2027-11-01').puzzleNumber).toBe(365)
    expect(generateDailyPuzzle('2028-11-01').puzzleNumber).toBe(731) // 2028 is a leap year
    expect(generateDailyPuzzle('2026-10-19').puzzleNumber).toBe(-13) // before launch
  })

  it('echoes the date it was generated for', () => {
    expect(generateDailyPuzzle('2027-03-14').date).toBe('2027-03-14')
  })
})
