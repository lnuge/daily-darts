/**
 * Summaries of a round: visits, par and ratings per target, best visit.
 * Pure functions over the steps from round.ts.
 */

import type { Hit } from './board'
import { findCheckout } from './checkout'
import type { RoundStep } from './round'

/** Extra darts over the minimum that still count as par: one spare visit. */
export const PAR_ALLOWANCE = 3
/** Darts over par that still rate yellow: one more visit. */
export const YELLOW_ALLOWANCE = 3

export type Rating = 'green' | 'yellow' | 'red'

export type Visit = {
  targetIndex: number
  hits: readonly Hit[]
  /** Points the visit scored; 0 if it bust. */
  points: number
  /** How the visit ended, or 'open' if it's still in progress. */
  end: 'open' | 'complete' | 'bust' | 'checkout' | 'capped'
}

export type TargetSummary = {
  target: number
  darts: number
  outcome: 'checkout' | 'capped' | null
  /** The fewest darts that can finish this target. */
  minDarts: number
  par: number
  rating: Rating
}

export type RoundSummary = {
  totalDarts: number
  targets: readonly TargetSummary[]
  /** Highest points scored in a single visit (busted visits score 0). */
  bestVisit: number
  visits: readonly Visit[]
}

/** The fewest darts that can finish `target` with a double. */
export function minDarts(target: number): number {
  const route = findCheckout(target)
  if (!route) throw new Error(`${target} has no checkout`)
  return route.length
}

export function targetPar(target: number): number {
  return minDarts(target) + PAR_ALLOWANCE
}

export function rateTarget(darts: number, par: number, outcome: TargetSummary['outcome']): Rating {
  if (outcome === 'capped') return 'red'
  if (darts <= par) return 'green'
  if (darts <= par + YELLOW_ALLOWANCE) return 'yellow'
  return 'red'
}

/** Groups darts into visits. A visit ends after 3 darts, a bust, or its target ending. */
export function splitVisits(steps: readonly RoundStep[]): Visit[] {
  const visits: Visit[] = []
  let hits: Hit[] = []
  let points = 0
  for (const step of steps) {
    hits.push(step.hit)
    points += step.hit.points
    // After a dart, dartsThisVisit is 0 exactly when that dart ended the visit.
    if (step.state.dartsThisVisit === 0) {
      const bust = step.outcome === 'bust'
      visits.push({
        targetIndex: step.targetIndex,
        hits,
        points: bust ? 0 : points,
        end: step.targetDone ?? (bust ? 'bust' : 'complete'),
      })
      hits = []
      points = 0
    }
  }
  if (hits.length) {
    const last = steps[steps.length - 1]
    visits.push({ targetIndex: last.targetIndex, hits, points, end: 'open' })
  }
  return visits
}

/** Summary of a round so far (finished or not). */
export function summarizeRound(
  steps: readonly RoundStep[],
  targets: readonly number[],
): RoundSummary {
  const final = steps.length ? steps[steps.length - 1].state : null
  const visits = splitVisits(steps)
  return {
    totalDarts: final?.totalDarts ?? 0,
    targets: targets.map((target, i) => {
      const progress = final?.targets[i] ?? { darts: 0, outcome: null }
      const par = targetPar(target)
      return {
        target,
        darts: progress.darts,
        outcome: progress.outcome,
        minDarts: minDarts(target),
        par,
        rating: rateTarget(progress.darts, par, progress.outcome),
      }
    }),
    bestVisit: visits.reduce((best, v) => Math.max(best, v.points), 0),
    visits,
  }
}
