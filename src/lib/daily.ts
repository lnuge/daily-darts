import { addDays, formatDateKey, parseDateKey } from '../game/date'
import { LAUNCH_DATE } from '../game/puzzle'

/**
 * Today's puzzle key, as the player's local date like "2026-10-19".
 *
 * Puzzles roll over at the player's local midnight, so at any moment two
 * dates can be live somewhere in the world. This reads the clock, so it lives
 * here rather than in src/game; game code receives the key as an argument.
 */
export function todayKey(now: Date = new Date()): string {
  return formatDateKey({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
}

/**
 * The local midnight at which `dateKey`'s puzzle ends and the next unlocks.
 * Built from local calendar parts, so days with a daylight-saving change
 * (23 or 25 hours long) come out right.
 */
export function puzzleEndsAt(dateKey: string): Date {
  const { year, month, day } = parseDateKey(addDays(dateKey, 1))
  return new Date(year, month - 1, day)
}

/** Milliseconds as "HH:MM:SS", rounded up to the second; never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
}

/** Before launch there are no past puzzles yet, so practice offers this many pre-launch days. */
const PRE_LAUNCH_PRACTICE_DAYS = 30

/**
 * Dates that can be practised: launch day up to yesterday. Today is the
 * ranked puzzle, so it's never offered.
 */
export function practiceRange(today: string): { min: string; max: string } {
  const max = addDays(today, -1)
  const min = today > LAUNCH_DATE ? LAUNCH_DATE : addDays(today, -PRE_LAUNCH_PRACTICE_DAYS)
  return { min, max }
}
