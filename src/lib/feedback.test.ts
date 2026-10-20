import { describe, expect, it } from 'vitest'
import { applyHit, createRound, type RoundStep } from '../game/round'
import { hitFromLabel } from '../game/test-helpers'
import { feedbackFor } from './feedback'

/** The step for throwing `label` at `remaining`, optionally after some darts. */
function step(target: number, labels: string[]): RoundStep {
  let state = createRound('2026-11-01', [target, 100])
  let last: RoundStep | undefined
  for (const label of labels) {
    last = applyHit(state, hitFromLabel(label))
    state = last.state
  }
  return last!
}

const names = (s: RoundStep) => feedbackFor(s).sounds.map((x) => x.name)

describe('feedbackFor', () => {
  it('thuds for a scoring dart, with no celebration', () => {
    expect(feedbackFor(step(100, ['T20']))).toEqual({
      sounds: [{ name: 'hit', delayMs: 0 }],
      celebrate: false,
    })
  })

  it('makes a duller sound for a miss', () => {
    expect(names(step(100, ['Miss']))).toEqual(['miss'])
  })

  it('plays the bust sound after the thud on a bust', () => {
    expect(names(step(40, ['T20']))).toEqual(['hit', 'bust'])
  })

  it('plays the checkout sound and celebrates when a target is finished', () => {
    const fb = feedbackFor(step(40, ['D20']))
    expect(fb.sounds.map((x) => x.name)).toEqual(['hit', 'checkout'])
    expect(fb.celebrate).toBe(true)
  })

  it('celebrates a bullseye finish too', () => {
    expect(feedbackFor(step(50, ['Bull'])).celebrate).toBe(true)
  })

  it("doesn't celebrate hitting the 30-dart limit", () => {
    const fb = feedbackFor(step(40, Array(30).fill('Miss')))
    expect(fb.sounds.map((x) => x.name)).toEqual(['miss', 'bust'])
    expect(fb.celebrate).toBe(false)
  })
})
