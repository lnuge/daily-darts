// GENERATED from src/game/puzzle.ts by scripts/sync-shared-game.mjs. Do not edit.
// Change src/game/puzzle.ts, then run: npm run sync:game

import { isCheckout } from './checkout.ts'
import { daysBetween, parseDateKey } from './date.ts'
import { createRng, hashString, type Rng } from './rng.ts'

/** Puzzle #0 is played on this date. Earlier dates get negative numbers. */
export const LAUNCH_DATE = '2026-11-01'

export const TARGET_RANGES = {
  easy: { min: 40, max: 80 },
  medium: { min: 81, max: 120 },
  hard: { min: 121, max: 170 },
} as const

/** Full crosshair sweeps (edge to edge) per second. */
export const SWEEP_SPEED_RANGE = { min: 0.6, max: 1.2 } as const

/** Aim wobble amplitude, as a fraction of the board radius. */
export const WOBBLE_RANGE = { min: 0.01, max: 0.04 } as const

export type Difficulty = keyof typeof TARGET_RANGES

export type DailyPuzzle = {
  /** The local date key this puzzle is for, e.g. "2026-11-01". */
  date: string
  /** Days since LAUNCH_DATE. */
  puzzleNumber: number
  /** Checkout targets in play order: easy, medium, hard. */
  targets: readonly [easy: number, medium: number, hard: number]
  /** Full crosshair sweeps per second, to 2 decimal places. */
  sweepSpeed: number
  /** Aim wobble amplitude as a fraction of board radius, to 3 decimal places. */
  wobble: number
}

/**
 * Seed for a player's local calendar date, e.g. "2026-10-19". Everyone on the
 * same date gets the same seed. Throws on anything that isn't a real date.
 */
export function getDailySeed(dateKey: string): number {
  parseDateKey(dateKey)
  return hashString(`daily-darts:${dateKey}`)
}

/**
 * Each puzzle field draws from its own named RNG stream, so adding a field
 * later (or changing how many draws one field makes) leaves the others alone.
 */
function stream(seed: number, name: string): Rng {
  return createRng(`${seed}:${name}`)
}

function pickCheckout(rng: Rng, difficulty: Difficulty): number {
  const { min, max } = TARGET_RANGES[difficulty]
  const candidates: number[] = []
  for (let score = min; score <= max; score++) {
    if (isCheckout(score)) candidates.push(score)
  }
  return candidates[rng.int(0, candidates.length - 1)]
}

/**
 * A value in [min, max] on a grid of 1/scale (scale = 100 for 2 decimal
 * places). Draws an integer and divides once, so the result is the same
 * correctly rounded double everywhere. (No `10 ** n`: pow isn't guaranteed
 * to be exact across engines.)
 */
function pickDecimal(rng: Rng, range: { min: number; max: number }, scale: number): number {
  return rng.int(Math.round(range.min * scale), Math.round(range.max * scale)) / scale
}

export function generateDailyPuzzle(dateKey: string): DailyPuzzle {
  const seed = getDailySeed(dateKey)

  const targetRng = stream(seed, 'targets')
  const targets = [
    pickCheckout(targetRng, 'easy'),
    pickCheckout(targetRng, 'medium'),
    pickCheckout(targetRng, 'hard'),
  ] as const

  return {
    date: dateKey,
    puzzleNumber: daysBetween(LAUNCH_DATE, dateKey),
    targets,
    sweepSpeed: pickDecimal(stream(seed, 'sweep'), SWEEP_SPEED_RANGE, 100),
    wobble: pickDecimal(stream(seed, 'wobble'), WOBBLE_RANGE, 1000),
  }
}
