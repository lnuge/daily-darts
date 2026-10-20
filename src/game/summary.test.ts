import { describe, expect, it } from 'vitest'
import { LAUNCH_DATE, generateDailyPuzzle } from './puzzle'
import { applyHit, createRound, replaySteps, type RoundStep } from './round'
import { minDarts, rateTarget, splitVisits, summarizeRound, targetPar } from './summary'
import { hitFromLabel, playRoundToFinish } from './test-helpers'

/** Plays labelled darts at a round over `targets`; returns the steps. */
function play(targets: number[], labels: string[]): RoundStep[] {
  let state = createRound(LAUNCH_DATE, targets)
  return labels.map((label) => {
    const step = applyHit(state, hitFromLabel(label))
    state = step.state
    return step
  })
}

describe('par', () => {
  it('is the fewest darts to finish plus one spare visit', () => {
    expect(minDarts(40)).toBe(1) // D20
    expect(minDarts(92)).toBe(2) // T20 D16
    expect(minDarts(170)).toBe(3) // T20 T20 Bull
    expect(targetPar(40)).toBe(4)
    expect(targetPar(92)).toBe(5)
    expect(targetPar(170)).toBe(6)
  })

  it('rates green at or under par, yellow up to a visit over, red beyond or capped', () => {
    expect(rateTarget(2, 5, 'checkout')).toBe('green')
    expect(rateTarget(5, 5, 'checkout')).toBe('green')
    expect(rateTarget(6, 5, 'checkout')).toBe('yellow')
    expect(rateTarget(8, 5, 'checkout')).toBe('yellow')
    expect(rateTarget(9, 5, 'checkout')).toBe('red')
    expect(rateTarget(30, 5, 'capped')).toBe('red')
  })
})

describe('splitVisits', () => {
  it('splits every 3 darts', () => {
    const visits = splitVisits(play([170], ['T20', 'T20', 'S20', 'S5', 'S1']))
    expect(visits.map((v) => [v.hits.length, v.points, v.end])).toEqual([
      [3, 140, 'complete'],
      [2, 6, 'open'],
    ])
  })

  it('ends a visit early on a bust and scores it 0', () => {
    const visits = splitVisits(play([40], ['S10', 'T20', 'S10']))
    expect(visits.map((v) => [v.hits.length, v.points, v.end])).toEqual([
      [2, 0, 'bust'],
      [1, 10, 'open'],
    ])
  })

  it('ends a visit on a checkout and moves to the next target', () => {
    const visits = splitVisits(play([92, 60], ['T20', 'D16', 'S20']))
    expect(visits.map((v) => [v.targetIndex, v.points, v.end])).toEqual([
      [0, 92, 'checkout'],
      [1, 20, 'open'],
    ])
  })

  it('marks a visit that hit the 30-dart cap', () => {
    const visits = splitVisits(play([40], Array(30).fill('Miss')))
    expect(visits).toHaveLength(10)
    expect(visits[9].end).toBe('capped')
  })
})

describe('summarizeRound', () => {
  it('reports total darts, darts and rating per target, and the best visit', () => {
    const labels = [
      // 92 (par 5): checked out in 2 darts.
      ...['T20', 'D16'],
      // 60 (par 5: S20 D20 + 3): a bust, two scoring visits, then misses to the 30-dart cap.
      ...['S20', 'S20', 'T20'], // bust: back to 60, scores 0
      ...['S20', 'S1', 'S1'], // 22, leaves 38
      ...['S20', 'S5', 'D5'], // 35, leaves 3
      ...Array(21).fill('Miss'), // 30 darts: capped
      // 170 (par 6): the maximum checkout in 3 darts.
      ...['T20', 'T20', 'Bull'],
    ]
    const summary = summarizeRound(play([92, 60, 170], labels), [92, 60, 170])
    expect(summary.targets.map((t) => [t.darts, t.outcome, t.par, t.rating])).toEqual([
      [2, 'checkout', 5, 'green'],
      [30, 'capped', 5, 'red'],
      [3, 'checkout', 6, 'green'],
    ])
    expect(summary.totalDarts).toBe(35)
    expect(summary.bestVisit).toBe(170)
    expect(summary.visits.filter((v) => v.end === 'bust')).toHaveLength(1)
  })

  it('summarises a real finished round', () => {
    const puzzle = generateDailyPuzzle(LAUNCH_DATE)
    const steps = replaySteps(LAUNCH_DATE, playRoundToFinish(LAUNCH_DATE))
    const summary = summarizeRound(steps, puzzle.targets)
    expect(summary.totalDarts).toBe(7)
    expect(summary.targets.map((t) => [t.target, t.darts, t.minDarts, t.rating])).toEqual([
      [55, 2, 2, 'green'],
      [101, 2, 2, 'green'],
      [152, 3, 3, 'green'],
    ])
    expect(summary.bestVisit).toBe(152)
  })

  it('handles a round with no darts yet', () => {
    const summary = summarizeRound([], [55, 101, 152])
    expect(summary.totalDarts).toBe(0)
    expect(summary.bestVisit).toBe(0)
    expect(summary.visits).toEqual([])
  })
})
