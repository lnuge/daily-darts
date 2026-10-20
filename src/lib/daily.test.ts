import { describe, expect, it } from 'vitest'
import { formatCountdown, practiceRange, puzzleEndsAt, todayKey } from './daily'

describe('todayKey', () => {
  it('uses the local calendar date', () => {
    expect(todayKey(new Date(2026, 9, 19, 23, 59, 59))).toBe('2026-10-19')
    expect(todayKey(new Date(2026, 9, 20, 0, 0, 0))).toBe('2026-10-20')
  })
})

describe('puzzleEndsAt', () => {
  it('is the local midnight at the start of the next day', () => {
    expect(puzzleEndsAt('2026-10-19')).toEqual(new Date(2026, 9, 20, 0, 0, 0))
    expect(puzzleEndsAt('2026-12-31')).toEqual(new Date(2027, 0, 1, 0, 0, 0))
    expect(puzzleEndsAt('2028-02-28')).toEqual(new Date(2028, 1, 29, 0, 0, 0))
  })

  it('is the moment todayKey moves on to the next puzzle', () => {
    const end = puzzleEndsAt('2026-10-19')
    expect(todayKey(new Date(end.getTime() - 1))).toBe('2026-10-19')
    expect(todayKey(end)).toBe('2026-10-20')
  })
})

describe('formatCountdown', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(1000)).toBe('00:00:01')
    expect(formatCountdown(61_000)).toBe('00:01:01')
    expect(formatCountdown(23 * 3600_000 + 59 * 60_000 + 59_000)).toBe('23:59:59')
  })

  it('rounds up partial seconds and never goes negative', () => {
    expect(formatCountdown(1)).toBe('00:00:01')
    expect(formatCountdown(-5000)).toBe('00:00:00')
  })
})

describe('practiceRange', () => {
  it('runs from launch day to yesterday after launch', () => {
    expect(practiceRange('2026-12-15')).toEqual({ min: '2026-11-01', max: '2026-12-14' })
  })

  it('never includes today', () => {
    expect(practiceRange('2026-11-02').max).toBe('2026-11-01')
  })

  it('offers the last 30 days before launch, when there are no past puzzles yet', () => {
    expect(practiceRange('2026-10-20')).toEqual({ min: '2026-09-20', max: '2026-10-19' })
  })
})
