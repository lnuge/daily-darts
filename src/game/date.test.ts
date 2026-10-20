import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, fromDayNumber, parseDateKey, toDayNumber } from './date.ts'

describe('parseDateKey', () => {
  it('accepts real dates, including leap days', () => {
    expect(parseDateKey('2026-10-19')).toEqual({ year: 2026, month: 10, day: 19 })
    expect(parseDateKey('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 })
    expect(parseDateKey('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 })
  })

  it.each([
    '',
    '2026-1-05',
    '2026/10/19',
    '19-10-2026',
    '2026-10-19T00:00',
    ' 2026-10-19',
    '2026-00-10',
    '2026-13-01',
    '2026-04-31',
    '2027-02-29',
    '2100-02-29',
    '2026-10-00',
  ])('rejects %j', (key) => {
    expect(() => parseDateKey(key)).toThrow()
  })
})

describe('toDayNumber / fromDayNumber', () => {
  it('agrees with Date.UTC for every day from 1999 to 2101', () => {
    const start = Date.UTC(1999, 0, 1) / 86_400_000
    const end = Date.UTC(2101, 11, 31) / 86_400_000
    for (let day = start; day <= end; day++) {
      const key = new Date(day * 86_400_000).toISOString().slice(0, 10)
      expect(toDayNumber(key)).toBe(day)
      expect(fromDayNumber(day)).toBe(key)
    }
  })
})

describe('daysBetween / addDays', () => {
  it('counts across month, year and leap-day boundaries', () => {
    expect(daysBetween('2026-10-19', '2026-11-01')).toBe(13)
    expect(daysBetween('2026-11-01', '2026-10-19')).toBe(-13)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(addDays('2026-11-01', 365)).toBe('2027-11-01')
    expect(addDays('2027-11-01', 366)).toBe('2028-11-01')
  })
})
