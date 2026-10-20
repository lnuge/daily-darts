/**
 * The rules of a round, as a pure state machine.
 *
 * The player works through the day's three targets in order. Each dart
 * subtracts its points from the current target. A target is finished by
 * reaching exactly 0 with a double (the bullseye counts as a double).
 *
 * Bust: going below 0, leaving exactly 1, or reaching 0 without a double.
 * A bust puts the score back to what it was at the start of the visit
 * (3 darts) and ends the visit; the bust dart still counts.
 *
 * A target ends after MAX_DARTS_PER_TARGET darts even if it isn't finished,
 * and then counts as that many darts.
 *
 * Every function returns a new state and never mutates its input.
 */

import type { Hit } from './board.ts'
import { generateDailyPuzzle, type DailyPuzzle } from './puzzle.ts'
import { resolveThrow, type ThrowInput, type ThrowResult } from './throw.ts'

export const DARTS_PER_VISIT = 3
export const MAX_DARTS_PER_TARGET = 30

export type TargetProgress = {
  /** The score this target starts from. */
  target: number
  /** Darts thrown at this target so far. A capped target has exactly MAX_DARTS_PER_TARGET. */
  darts: number
  /** How the target ended, or null while it's still in play (or not reached yet). */
  outcome: 'checkout' | 'capped' | null
}

export type RoundState = {
  date: string
  /** All three targets, in play order. */
  targets: readonly TargetProgress[]
  /** Index of the target in play; equals targets.length once the round is finished. */
  current: number
  /** Score left on the current target (0 once finished). */
  remaining: number
  /** `remaining` at the start of the current visit: where a bust returns to. */
  visitStart: number
  /** Darts thrown in the current visit so far (0 at the start of a visit). */
  dartsThisVisit: number
  /** Darts thrown across all targets. */
  totalDarts: number
  finished: boolean
}

export type DartOutcome = 'score' | 'bust' | 'checkout'

/** One dart's effect, for the UI to react to (sounds, flashes, HUD). */
export type RoundStep = {
  state: RoundState
  hit: Hit
  outcome: DartOutcome
  /** Index of the target this dart was thrown at. */
  targetIndex: number
  /** Remaining score on that target before the dart. */
  remainingBefore: number
  /** Set when this dart ended its target. */
  targetDone: 'checkout' | 'capped' | null
}

export type ThrowStep = RoundStep & { throw: ThrowResult }

/** A fresh round over the given targets. */
export function createRound(date: string, targets: readonly number[]): RoundState {
  if (targets.length === 0) throw new Error('A round needs at least one target')
  for (const target of targets) {
    if (!Number.isInteger(target) || target < 2) throw new Error(`Invalid target ${target}`)
  }
  return {
    date,
    targets: targets.map((target) => ({ target, darts: 0, outcome: null })),
    current: 0,
    remaining: targets[0],
    visitStart: targets[0],
    dartsThisVisit: 0,
    totalDarts: 0,
    finished: false,
  }
}

/** A fresh round for a day's puzzle. */
export function startRound(puzzle: DailyPuzzle): RoundState {
  return createRound(puzzle.date, puzzle.targets)
}

/** What a dart does to a remaining score, under the rules above. */
export function dartOutcome(remaining: number, hit: Hit): DartOutcome {
  const after = remaining - hit.points
  if (after === 0 && hit.isDouble) return 'checkout'
  if (after < 0 || after === 1 || after === 0) return 'bust'
  return 'score'
}

/** Applies one scored dart to the round. */
export function applyHit(state: RoundState, hit: Hit): RoundStep {
  if (state.finished) throw new Error('The round is already finished')

  const outcome = dartOutcome(state.remaining, hit)
  const progress = state.targets[state.current]
  const darts = progress.darts + 1
  const targetDone: TargetProgress['outcome'] =
    outcome === 'checkout' ? 'checkout' : darts >= MAX_DARTS_PER_TARGET ? 'capped' : null

  const targets = state.targets.map((t, i) =>
    i === state.current ? { ...t, darts, outcome: targetDone } : t,
  )
  const totalDarts = state.totalDarts + 1
  const step = {
    hit,
    outcome,
    targetIndex: state.current,
    remainingBefore: state.remaining,
    targetDone,
  }

  if (targetDone) {
    // On to the next target, with a fresh visit.
    const current = state.current + 1
    const finished = current === targets.length
    const remaining = finished ? 0 : targets[current].target
    return {
      ...step,
      state: {
        ...state,
        targets,
        current,
        remaining,
        visitStart: remaining,
        dartsThisVisit: 0,
        totalDarts,
        finished,
      },
    }
  }

  const remaining = outcome === 'bust' ? state.visitStart : state.remaining - hit.points
  const dartsThisVisit = state.dartsThisVisit + 1
  const visitOver = outcome === 'bust' || dartsThisVisit === DARTS_PER_VISIT
  return {
    ...step,
    state: {
      ...state,
      targets,
      remaining,
      visitStart: visitOver ? remaining : state.visitStart,
      dartsThisVisit: visitOver ? 0 : dartsThisVisit,
      totalDarts,
    },
  }
}

/** Resolves a throw from its taps and applies it to the round. */
export function playThrow(state: RoundState, puzzle: DailyPuzzle, input: ThrowInput): ThrowStep {
  if (puzzle.date !== state.date) {
    throw new Error(`Puzzle for ${puzzle.date} doesn't match round for ${state.date}`)
  }
  const result = resolveThrow(puzzle, input)
  return { ...applyHit(state, result.hit), throw: result }
}

/**
 * Replays a whole round from the day and the list of throw inputs. Throws if
 * any input is invalid or if there are inputs after the round finished. The
 * returned state may be unfinished if the inputs stop early.
 */
export function replayRound(date: string, inputs: readonly ThrowInput[]): RoundState {
  const steps = replaySteps(date, inputs)
  return steps.length ? steps[steps.length - 1].state : startRound(generateDailyPuzzle(date))
}

/** Like replayRound, but returns every step (for visit history and summaries). */
export function replaySteps(date: string, inputs: readonly ThrowInput[]): ThrowStep[] {
  const puzzle = generateDailyPuzzle(date)
  let state = startRound(puzzle)
  const steps: ThrowStep[] = []
  for (const input of inputs) {
    const step = playThrow(state, puzzle, input)
    steps.push(step)
    state = step.state
  }
  return steps
}
