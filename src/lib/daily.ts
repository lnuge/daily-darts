import { formatDateKey } from '../game/date'

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
