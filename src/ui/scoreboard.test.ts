import { describe, expect, it } from 'vitest'
import { generateDailyPuzzle } from '../game/puzzle'
import { applyHit, createRound, playThrow, startRound, type RoundStep } from '../game/round'
import { hitFromLabel, playRoundToFinish } from '../game/test-helpers'
import { chalkedScores } from './scoreboard'

/** Plays darts by label ("T20", "S5", "D10", "Miss") and returns every step. */
function play(targets: number[], labels: string[]): RoundStep[] {
  let state = createRound('2026-11-01', targets)
  return labels.map((label) => {
    const step = applyHit(state, hitFromLabel(label))
    state = step.state
    return step
  })
}

const scoresAfter = (steps: RoundStep[]) => chalkedScores(steps, steps[steps.length - 1].state)

describe('chalkedScores', () => {
  it('starts with just the target', () => {
    const round = createRound('2026-11-01', [121, 60, 80])
    expect(chalkedScores([], round)).toEqual([121])
  })

  it("adds the score left after each visit, but not one that's under way", () => {
    expect(scoresAfter(play([121, 60, 80], ['T20']))).toEqual([121])
    expect(scoresAfter(play([121, 60, 80], ['T20', 'S1', 'S20']))).toEqual([121, 40])
    expect(scoresAfter(play([121, 60, 80], ['T20', 'S1', 'S20', 'S10', 'S10', 'S10']))).toEqual([
      121, 40, 10,
    ])
  })

  it('writes the same score again after a bust', () => {
    // 40 left; T20 busts and ends the visit.
    expect(scoresAfter(play([121, 60, 80], ['T20', 'S1', 'S20', 'T20']))).toEqual([121, 40, 40])
  })

  it('starts afresh on the next target', () => {
    const steps = play([40, 60, 80], ['D20', 'S20'])
    expect(scoresAfter(steps)).toEqual([60])
    expect(scoresAfter(steps.slice(0, 1))).toEqual([60])
  })

  it("always ends with where the current visit started, through a whole day's round", () => {
    const date = '2026-11-03'
    const puzzle = generateDailyPuzzle(date)
    let state = startRound(puzzle)
    const steps: RoundStep[] = []
    for (const input of playRoundToFinish(date)) {
      steps.push(playThrow(state, puzzle, input))
      state = steps[steps.length - 1].state
      if (!state.finished) expect(chalkedScores(steps, state).at(-1)).toBe(state.visitStart)
    }
    expect(chalkedScores(steps, state)).toEqual([])
  })
})
