/** Helpers for tests only. Not imported by app code. */

import { scoreHit, type Hit } from './board.ts'
import { findCheckout, type Dart } from './checkout.ts'
import { generateDailyPuzzle, type DailyPuzzle } from './puzzle.ts'
import { dartOutcome, playThrow, startRound } from './round.ts'
import { aimPoint, resolveThrow, type ThrowInput } from './throw.ts'

/**
 * Independent of the solver: is `route` a legal double-out finish for `score`?
 */
export function isLegalCheckoutRoute(score: number, route: readonly Dart[]): boolean {
  if (route.length < 1 || route.length > 3) return false
  for (const { segment, multiplier } of route) {
    const isNumber = Number.isInteger(segment) && segment >= 1 && segment <= 20
    const isBull = segment === 25
    if (!isNumber && !isBull) return false
    if (isNumber && ![1, 2, 3].includes(multiplier)) return false
    if (isBull && ![1, 2].includes(multiplier)) return false // no treble bull
  }
  if (route[route.length - 1].multiplier !== 2) return false
  return route.reduce((sum, d) => sum + d.segment * d.multiplier, 0) === score
}

/**
 * Searches tap times for a throw whose result satisfies `wanted`. Tries the
 * taps whose aim point already scores what's wanted first (cheap), then
 * everything. Deterministic: always returns the same input.
 */
export function findInput(
  puzzle: DailyPuzzle,
  wanted: (hit: Hit) => boolean,
  stepMs = 3,
): ThrowInput | null {
  const cycle = Math.ceil(2000 / puzzle.sweepSpeed) // one full back-and-forth
  for (const aimMustMatch of [true, false]) {
    for (let lockX = 0; lockX < cycle; lockX += stepMs) {
      for (let dy = 0; dy < cycle; dy += stepMs) {
        const input = { lockX, lockY: lockX + dy }
        if (aimMustMatch) {
          const aim = aimPoint(input, puzzle.sweepSpeed)
          if (!wanted(scoreHit(aim.x, aim.y))) continue
        }
        if (wanted(resolveThrow(puzzle, input).hit)) return input
      }
    }
  }
  return null
}

/**
 * A bot that plays a day's round to the finish with real throw inputs: each
 * dart aims for the first dart of the solver's checkout route (or T20 when
 * there's no route yet). Returns the inputs, ready for replayRound.
 */
export function playRoundToFinish(date: string): ThrowInput[] {
  const puzzle = generateDailyPuzzle(date)
  let state = startRound(puzzle)
  const inputs: ThrowInput[] = []
  while (!state.finished) {
    const want = findCheckout(state.remaining)?.[0] ?? { segment: 20, multiplier: 3 }
    const remaining = state.remaining
    const input =
      findInput(puzzle, (h) => h.segment === want.segment && h.multiplier === want.multiplier) ??
      findInput(puzzle, (h) => h.points > 0 && dartOutcome(remaining, h) !== 'bust')
    if (!input) throw new Error(`Bot found no useful throw at ${remaining}`)
    state = playThrow(state, puzzle, input).state
    inputs.push(input)
  }
  return inputs
}

/** A hit from a label: "T20", "D16", "S5", "Bull", "25" or "Miss". */
export function hitFromLabel(label: string): Hit {
  if (label === 'Miss') return { segment: 0, multiplier: 0, points: 0, isDouble: false }
  if (label === 'Bull') return { segment: 25, multiplier: 2, points: 50, isDouble: true }
  if (label === '25') return { segment: 25, multiplier: 1, points: 25, isDouble: false }
  const multiplier = ('SDT'.indexOf(label[0]) + 1) as 1 | 2 | 3
  const segment = Number(label.slice(1))
  return { segment, multiplier, points: segment * multiplier, isDouble: multiplier === 2 }
}
