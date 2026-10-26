/**
 * Which puzzles are in the archive: the published, search-indexed pages that
 * show a day's targets, best finishes and top scores.
 *
 * A date only joins the archive once it's over everywhere on Earth and the
 * server has stopped taking rounds for it, so the archive never spoils a
 * puzzle someone can still play for rank, and its top scores are final. A
 * date is "today" somewhere until 12:00 UTC the next day (UTC-12), and the
 * server takes rounds for GRACE_HOURS (6) after that
 * (supabase/functions/submit-round/submit.ts): so date D is archived from
 * D+1 18:00 UTC, which is 42 hours after D 00:00 UTC.
 *
 * It starts where practice starts: launch day, or before launch the last 30
 * days (practiceRange in daily.ts).
 */

import { addDays, daysBetween } from '../game/date'
import { practiceRange } from './daily'

export const ARCHIVE_DELAY_HOURS = 42

/** How many top scores an archive page shows. */
export const ARCHIVE_TOP = 10

/** The UTC calendar date of a moment, like "2026-11-14". */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** The newest date in the archive at `nowMs`. */
export function latestArchived(nowMs: number): string {
  return utcDateKey(nowMs - ARCHIVE_DELAY_HOURS * 3_600_000)
}

/** The oldest date in the archive at `nowMs`. */
export function firstArchived(nowMs: number): string {
  return practiceRange(utcDateKey(nowMs)).min
}

/** Every archived date at `nowMs`, newest first (empty if there are none yet). */
export function archiveDates(nowMs: number): string[] {
  const first = firstArchived(nowMs)
  const latest = latestArchived(nowMs)
  const count = daysBetween(first, latest) + 1
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(latest, -i))
}

export function isArchived(date: string, nowMs: number): boolean {
  return date >= firstArchived(nowMs) && date <= latestArchived(nowMs)
}
