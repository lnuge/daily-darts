/**
 * The throw mechanic, as pure functions.
 *
 * A vertical aim line sweeps left and right; the player taps to lock X. Then
 * a horizontal line sweeps up and down; the player taps to lock Y. The dart
 * lands near that aim point, scattered by today's wobble.
 *
 * A throw is fully described by its input: the two tap times, in whole
 * milliseconds from the start of the throw. `resolveThrow` turns that input
 * into a landing point and score, the same way on every machine, so the
 * server can replay it.
 */

import { scoreHit, type Hit } from './board'
import { getDailySeed, type DailyPuzzle } from './puzzle'
import { createRng, type Rng } from './rng'

/**
 * The aim lines sweep between -SWEEP_EXTENT and +SWEEP_EXTENT in board
 * units: a little past the double ring (radius 1), so a badly timed tap can
 * miss the board.
 */
export const SWEEP_EXTENT = 1.1

/** The longest a throw may take, from start to the second tap. */
export const MAX_THROW_MS = 60 * 60 * 1000

export type ThrowInput = {
  /** Whole ms from the start of the throw to the tap that locked X. */
  lockX: number
  /** Whole ms from the start of the throw (not from lockX) to the tap that locked Y. */
  lockY: number
}

export type Point = { x: number; y: number }

export type ThrowResult = {
  input: ThrowInput
  /** Where the two locked lines crossed. */
  aim: Point
  /** Where the dart actually landed, after scatter. */
  landing: Point
  hit: Hit
}

/**
 * Position of an aim line `elapsedMs` after it started sweeping. It starts at
 * -SWEEP_EXTENT, moves at a constant speed to +SWEEP_EXTENT, comes back, and
 * repeats (a triangle wave, so no trig). One edge-to-edge pass takes
 * 1000 / sweepSpeed ms. Negative times count as 0.
 *
 * Also used by the renderer, so the line on screen is the line that locks.
 */
export function sweepPosition(elapsedMs: number, sweepSpeed: number): number {
  const t = Math.max(0, elapsedMs)
  // sweepSpeed has 2 decimal places (see puzzle.ts): work in whole hundredths
  // so `t * speed` is an exact integer when t is, then divide once.
  const passes = (t * Math.round(sweepSpeed * 100)) / 100_000
  const phase = passes % 2 // [0, 1): outward, [1, 2): back
  const along = phase <= 1 ? phase : 2 - phase // 0 at the start edge, 1 at the far edge
  return SWEEP_EXTENT * (2 * along - 1)
}

/** Throws unless `input` is something a real player could have produced. */
export function validateThrowInput(input: ThrowInput): void {
  const { lockX, lockY } = input
  if (!Number.isSafeInteger(lockX) || !Number.isSafeInteger(lockY)) {
    throw new Error(`Throw times must be whole milliseconds: ${JSON.stringify(input)}`)
  }
  if (lockX < 0 || lockY < lockX || lockY > MAX_THROW_MS) {
    throw new Error(`Throw times out of range: ${JSON.stringify(input)}`)
  }
}

/** The aim point the two taps locked in, before scatter. */
export function aimPoint(input: ThrowInput, sweepSpeed: number): Point {
  return {
    x: sweepPosition(input.lockX, sweepSpeed),
    // The horizontal line starts sweeping at the moment X locks.
    y: sweepPosition(input.lockY - input.lockX, sweepSpeed),
  }
}

/**
 * A uniformly random point in the unit disc, by rejection sampling (no trig).
 * Each attempt succeeds with probability pi/4, so 64 failures in a row has
 * odds below 1e-42; the fallback only exists so the loop is bounded.
 */
export function randomInUnitDisc(rng: Rng): Point {
  for (let attempt = 0; attempt < 64; attempt++) {
    const x = rng.next() * 2 - 1
    const y = rng.next() * 2 - 1
    if (x * x + y * y <= 1) return { x, y }
  }
  return { x: 0, y: 0 }
}

/**
 * Turns a throw's input into where the dart lands and what it scores.
 *
 * Scatter is a uniform random offset within `puzzle.wobble` board units of
 * the aim point. Its RNG is seeded from the day and both tap times, so the
 * same taps on the same day always land in the same place, while a tap one
 * millisecond different scatters differently.
 */
export function resolveThrow(puzzle: DailyPuzzle, input: ThrowInput): ThrowResult {
  validateThrowInput(input)
  const aim = aimPoint(input, puzzle.sweepSpeed)
  const rng = createRng(`${getDailySeed(puzzle.date)}:throw:${input.lockX}:${input.lockY}`)
  const offset = randomInUnitDisc(rng)
  const landing = {
    x: aim.x + offset.x * puzzle.wobble,
    y: aim.y + offset.y * puzzle.wobble,
  }
  return {
    input: { lockX: input.lockX, lockY: input.lockY },
    aim,
    landing,
    hit: scoreHit(landing.x, landing.y),
  }
}
