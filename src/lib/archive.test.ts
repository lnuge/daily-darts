import { describe, expect, it } from 'vitest'
import { archiveDates, firstArchived, isArchived, latestArchived, utcDateKey } from './archive'
import { formatLongDate, formatShortDate } from './daily'

const at = (iso: string) => Date.parse(iso)

describe('latestArchived', () => {
  it('adds a date at 18:00 UTC the next day, once rounds for it are closed everywhere', () => {
    expect(latestArchived(at('2026-11-15T17:59:59Z'))).toBe('2026-11-13')
    expect(latestArchived(at('2026-11-15T18:00:00Z'))).toBe('2026-11-14')
    expect(latestArchived(at('2026-11-16T17:59:59Z'))).toBe('2026-11-14')
  })
})

describe('archiveDates', () => {
  it('runs from launch day to the latest archived date, newest first', () => {
    const dates = archiveDates(at('2026-11-05T20:00:00Z'))
    expect(dates).toEqual(['2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01'])
  })

  it('drops the pre-launch days the day after launch, and starts again from launch day', () => {
    expect(archiveDates(at('2026-11-01T12:00:00Z'))[0]).toBe('2026-10-30')
    expect(archiveDates(at('2026-11-02T17:00:00Z'))).toEqual([])
    expect(archiveDates(at('2026-11-02T18:00:00Z'))).toEqual(['2026-11-01'])
  })

  it('before launch, covers the pre-launch practice days', () => {
    const dates = archiveDates(at('2026-10-26T19:00:00Z'))
    expect(dates[0]).toBe('2026-10-25')
    expect(dates.at(-1)).toBe(firstArchived(at('2026-10-26T19:00:00Z')))
    expect(dates.at(-1)).toBe('2026-09-26')
  })

  it('grows by one a day after launch', () => {
    expect(archiveDates(at('2027-11-02T18:00:00Z'))).toHaveLength(366)
  })
})

describe('isArchived', () => {
  const now = at('2026-11-20T19:00:00Z')
  it('is true only between launch and the latest archived date', () => {
    expect(isArchived('2026-11-01', now)).toBe(true)
    expect(isArchived('2026-11-19', now)).toBe(true)
    expect(isArchived('2026-11-20', now)).toBe(false)
    expect(isArchived('2026-10-31', now)).toBe(false)
  })
})

describe('dates', () => {
  it('formats the calendar date itself, in British English', () => {
    expect(formatLongDate('2026-11-14')).toBe('Saturday 14 November 2026')
    expect(formatShortDate('2026-11-14')).toBe('14 Nov 2026')
    expect(formatLongDate('2026-11-01')).toBe('Sunday 1 November 2026')
    expect(formatLongDate('2027-01-04')).toBe('Monday 4 January 2027')
    expect(formatLongDate('1969-12-31')).toBe('Wednesday 31 December 1969')
    expect(utcDateKey(at('2026-11-14T23:59:59Z'))).toBe('2026-11-14')
  })
})
