// GENERATED from src/game/date.ts by scripts/sync-shared-game.mjs. Do not edit.
// Change src/game/date.ts, then run: npm run sync:game

/**
 * Calendar math on "YYYY-MM-DD" date keys, using integer arithmetic only.
 *
 * `Date` is off limits in src/game (it reads the clock and depends on the
 * host's time zone), so this converts between date keys and a day count
 * directly. Algorithms from Howard Hinnant's "chrono-Compatible Low-Level
 * Date Algorithms".
 */

export type CivilDate = { year: number; month: number; day: number }

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/** Parses a date key, throwing unless it is a real calendar date. */
export function parseDateKey(dateKey: string): CivilDate {
  const match = DATE_KEY.exec(dateKey)
  if (!match) throw new Error(`Invalid date key "${dateKey}": expected YYYY-MM-DD`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid date key "${dateKey}": no such date`)
  }
  return { year, month, day }
}

export function formatDateKey({ year, month, day }: CivilDate): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** Days since 1970-01-01 (which is day 0). */
export function toDayNumber(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey)
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const shiftedMonth = month > 2 ? month - 3 : month + 9 // March = 0
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

/** Inverse of toDayNumber. */
export function fromDayNumber(dayNumber: number): string {
  const z = dayNumber + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  )
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0)
  return formatDateKey({ year, month, day })
}

/** Whole days from `from` to `to`; negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

export function addDays(dateKey: string, days: number): string {
  return fromDayNumber(toDayNumber(dateKey) + days)
}
