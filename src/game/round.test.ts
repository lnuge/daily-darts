import { describe, expect, it } from 'vitest'
import { LAUNCH_DATE, generateDailyPuzzle } from './puzzle'
import {
  MAX_DARTS_PER_TARGET,
  applyHit,
  createRound,
  dartOutcome,
  playThrow,
  replayRound,
  startRound,
  type RoundState,
  type RoundStep,
} from './round'
import { hitFromLabel as h, playRoundToFinish } from './test-helpers'

/** Throws the labelled darts in order; returns every step. */
function play(state: RoundState, labels: string[]): RoundStep[] {
  const steps: RoundStep[] = []
  for (const label of labels) {
    const step = applyHit(state, h(label))
    steps.push(step)
    state = step.state
  }
  return steps
}

const last = <T>(items: T[]): T => items[items.length - 1]

/** A single-target round: makes the rules easy to read in isolation. */
const single = (target: number) => createRound(LAUNCH_DATE, [target])

describe('normal checkouts', () => {
  it('finishes 92 with T20 D16 in two darts', () => {
    const round = createRound(LAUNCH_DATE, [92, 60, 121])
    const steps = play(round, ['T20', 'D16'])
    expect(steps.map((s) => s.outcome)).toEqual(['score', 'checkout'])
    expect(steps[0].state.remaining).toBe(32)
    const { state, targetDone } = last(steps)
    expect(targetDone).toBe('checkout')
    expect(state.targets[0]).toEqual({ target: 92, darts: 2, outcome: 'checkout' })
    // On to the second target, with a fresh visit.
    expect(state.current).toBe(1)
    expect(state.remaining).toBe(60)
    expect(state.visitStart).toBe(60)
    expect(state.dartsThisVisit).toBe(0)
    expect(state.totalDarts).toBe(2)
    expect(state.finished).toBe(false)
  })

  it('counts the bullseye as a double', () => {
    const steps = play(single(50), ['Bull'])
    expect(last(steps).outcome).toBe('checkout')
    expect(last(steps).state.finished).toBe(true)
  })

  it('finishes over several visits, starting a new visit every 3 darts', () => {
    const steps = play(single(101), ['S20', 'S20', 'S20', 'S1', 'D20'])
    expect(steps.map((s) => s.state.dartsThisVisit)).toEqual([1, 2, 0, 1, 0])
    expect(steps.map((s) => s.state.remaining)).toEqual([81, 61, 41, 40, 0])
    expect(steps[2].state.visitStart).toBe(41) // the second visit starts from 41
    expect(last(steps).state.targets[0]).toEqual({ target: 101, darts: 5, outcome: 'checkout' })
  })

  it('counts misses as darts thrown', () => {
    const steps = play(single(40), ['Miss', 'Miss', 'D20'])
    expect(steps.map((s) => s.outcome)).toEqual(['score', 'score', 'checkout'])
    expect(last(steps).state.totalDarts).toBe(3)
  })

  it('finishes the round after the third target, totalling darts across targets', () => {
    const round = createRound(LAUNCH_DATE, [40, 92, 170])
    const { state } = last(play(round, ['D20', 'T20', 'D16', 'T20', 'T20', 'Bull']))
    expect(state.finished).toBe(true)
    expect(state.current).toBe(3)
    expect(state.remaining).toBe(0)
    expect(state.totalDarts).toBe(6)
    expect(state.targets.map((t) => t.darts)).toEqual([1, 2, 3])
    expect(state.targets.every((t) => t.outcome === 'checkout')).toBe(true)
  })

  it('works through the puzzle targets in order', () => {
    const puzzle = generateDailyPuzzle(LAUNCH_DATE)
    const round = startRound(puzzle)
    expect(round.targets.map((t) => t.target)).toEqual([...puzzle.targets])
    expect(round.remaining).toBe(puzzle.targets[0])
  })
})

describe('busts', () => {
  it.each([
    ['going below zero', 40, 'T20'],
    ['leaving exactly 1', 41, 'D20'],
    ['reaching 0 with a single', 20, 'S20'],
    ['reaching 0 with a treble', 60, 'T20'],
    ['reaching 0 with the outer bull', 25, '25'],
  ])('busts on %s', (_, target, dart) => {
    const step = applyHit(single(target), h(dart))
    expect(step.outcome).toBe('bust')
    expect(step.targetDone).toBeNull()
    expect(step.state.remaining).toBe(target)
  })

  it('returns to the score at the start of the visit, not before the dart', () => {
    const steps = play(single(100), ['T20', 'S20', 'T20'])
    expect(steps.map((s) => s.state.remaining)).toEqual([40, 20, 100])
    expect(last(steps).outcome).toBe('bust')
  })

  it('returns to the start of the current visit, not of the target', () => {
    // Visit 1: 100 -> 41. Visit 2 starts at 41; S20 leaves 21, then T20 busts.
    const steps = play(single(100), ['S20', 'S20', 'S19', 'S20', 'T20'])
    expect(last(steps).outcome).toBe('bust')
    expect(last(steps).state.remaining).toBe(41)
  })

  it('ends the visit, but the bust dart still counts', () => {
    const steps = play(single(40), ['S10', 'T20', 'S10'])
    expect(steps[1].outcome).toBe('bust')
    expect(steps[1].state.dartsThisVisit).toBe(0) // next dart starts a new visit
    expect(steps[1].state.totalDarts).toBe(2)
    expect(steps[2].state.dartsThisVisit).toBe(1)
    expect(steps[2].state.visitStart).toBe(40)
    expect(steps[2].state.remaining).toBe(30)
  })

  it('agrees with dartOutcome for every remaining score and dart', () => {
    const darts = ['Miss', 'S1', 'D1', 'T1', 'S20', 'D20', 'T20', '25', 'Bull']
    for (let remaining = 2; remaining <= 170; remaining++) {
      for (const label of darts) {
        const hit = h(label)
        const after = remaining - hit.points
        const expected = after === 0 && hit.isDouble ? 'checkout' : after < 2 ? 'bust' : 'score'
        expect(dartOutcome(remaining, hit), `${remaining} ${label}`).toBe(expected)
      }
    }
  })
})

describe('the 30-dart cap', () => {
  it('ends a target after 30 darts and counts it as 30', () => {
    const round = createRound(LAUNCH_DATE, [40, 60])
    const steps = play(round, Array(MAX_DARTS_PER_TARGET).fill('Miss'))
    expect(steps.slice(0, -1).every((s) => s.targetDone === null)).toBe(true)
    const { state, targetDone } = last(steps)
    expect(targetDone).toBe('capped')
    expect(state.targets[0]).toEqual({ target: 40, darts: 30, outcome: 'capped' })
    expect(state.current).toBe(1)
    expect(state.remaining).toBe(60)
    expect(state.totalDarts).toBe(30)
  })

  it('still counts a checkout on the 30th dart as a checkout', () => {
    const steps = play(single(40), [...Array(29).fill('Miss'), 'D20'])
    expect(last(steps).targetDone).toBe('checkout')
    expect(last(steps).state.targets[0].darts).toBe(30)
  })

  it('caps a target whose 30th dart busts', () => {
    const steps = play(single(40), [...Array(29).fill('Miss'), 'T20'])
    expect(last(steps).outcome).toBe('bust')
    expect(last(steps).targetDone).toBe('capped')
  })

  it('finishes the round at 90 darts if every target is capped', () => {
    const steps = play(startRound(generateDailyPuzzle(LAUNCH_DATE)), Array(90).fill('Miss'))
    const { state } = last(steps)
    expect(state.finished).toBe(true)
    expect(state.totalDarts).toBe(90)
    expect(state.targets.map((t) => t.outcome)).toEqual(['capped', 'capped', 'capped'])
  })
})

describe('state handling', () => {
  it('never mutates the state it is given', () => {
    const round = createRound(LAUNCH_DATE, [92, 60])
    const before = JSON.stringify(round)
    play(round, ['T20', 'D16', 'T20'])
    expect(JSON.stringify(round)).toBe(before)
  })

  it('refuses darts after the round is finished', () => {
    const { state } = last(play(single(40), ['D20']))
    expect(() => applyHit(state, h('S1'))).toThrow()
  })

  it.each([[[]], [[1]], [[40, 1.5]]])('rejects invalid targets %j', (targets) => {
    expect(() => createRound(LAUNCH_DATE, targets)).toThrow()
  })
})

describe('replayRound', () => {
  // Real tap inputs that finish the launch-day round, found by a bot.
  const inputs = playRoundToFinish(LAUNCH_DATE)

  it('replays real throw inputs to a finished round', () => {
    const state = replayRound(LAUNCH_DATE, inputs)
    expect(state.finished).toBe(true)
    expect(state.totalDarts).toBe(inputs.length)
    expect(state.targets.every((t) => t.outcome === 'checkout')).toBe(true)
  })

  it('gives the same final state every time', () => {
    expect(replayRound(LAUNCH_DATE, inputs)).toEqual(replayRound(LAUNCH_DATE, inputs))
  })

  it('matches playing the throws one at a time', () => {
    const puzzle = generateDailyPuzzle(LAUNCH_DATE)
    let state = startRound(puzzle)
    for (const input of inputs) state = playThrow(state, puzzle, input).state
    expect(replayRound(LAUNCH_DATE, inputs)).toEqual(state)
  })

  it('replays a recorded round exactly', () => {
    // Pinned: if this changes, stored rounds no longer replay the same.
    const state = replayRound(LAUNCH_DATE, inputs)
    expect({ inputs, targets: state.targets, totalDarts: state.totalDarts }).toMatchInlineSnapshot(`
      {
        "inputs": [
          {
            "lockX": 654,
            "lockY": 1575,
          },
          {
            "lockX": 843,
            "lockY": 1917,
          },
          {
            "lockX": 654,
            "lockY": 1575,
          },
          {
            "lockX": 585,
            "lockY": 1182,
          },
          {
            "lockX": 552,
            "lockY": 819,
          },
          {
            "lockX": 552,
            "lockY": 819,
          },
          {
            "lockX": 117,
            "lockY": 1674,
          },
        ],
        "targets": [
          {
            "darts": 2,
            "outcome": "checkout",
            "target": 55,
          },
          {
            "darts": 2,
            "outcome": "checkout",
            "target": 101,
          },
          {
            "darts": 3,
            "outcome": "checkout",
            "target": 152,
          },
        ],
        "totalDarts": 7,
      }
    `)
  })

  it('returns an unfinished state for a partial round', () => {
    const state = replayRound(LAUNCH_DATE, inputs.slice(0, 2))
    expect(state.finished).toBe(false)
    expect(state.totalDarts).toBe(2)
  })

  it('starts a fresh round from no inputs', () => {
    expect(replayRound(LAUNCH_DATE, [])).toEqual(startRound(generateDailyPuzzle(LAUNCH_DATE)))
  })

  it('rejects inputs after the round finished', () => {
    expect(() => replayRound(LAUNCH_DATE, [...inputs, { lockX: 100, lockY: 200 }])).toThrow()
  })

  it('rejects an invalid throw input', () => {
    expect(() => replayRound(LAUNCH_DATE, [{ lockX: 500, lockY: 100 }])).toThrow()
    expect(() => replayRound(LAUNCH_DATE, [{ lockX: 0.5, lockY: 100 }])).toThrow()
  })

  it('rejects a puzzle from a different day', () => {
    const round = startRound(generateDailyPuzzle(LAUNCH_DATE))
    expect(() =>
      playThrow(round, generateDailyPuzzle('2026-11-02'), { lockX: 0, lockY: 0 }),
    ).toThrow()
  })
})
