/**
 * Today's puzzle key, as a UTC date string like "2026-10-19".
 *
 * Everyone worldwide plays the same puzzle and it rolls over at 00:00 UTC.
 * This reads the clock, so it lives here rather than in src/game; game code
 * receives the key as an argument.
 */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
