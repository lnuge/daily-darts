import { describe, expect, it } from 'vitest'
import type { RoundSummary, TargetSummary } from '../game/summary'
import { buildShareText } from './share'

const target = (darts: number, rating: TargetSummary['rating']): TargetSummary => ({
  target: 100,
  darts,
  outcome: 'checkout',
  minDarts: 2,
  par: 5,
  rating,
})

const summary = (targets: TargetSummary[], totalDarts: number): RoundSummary => ({
  totalDarts,
  targets,
  bestVisit: 0,
  visits: [],
})

describe('buildShareText', () => {
  it('matches the agreed format', () => {
    const text = buildShareText(
      12,
      summary([target(4, 'green'), target(7, 'yellow'), target(9, 'red')], 20),
      'https://dailydarts.example',
    )
    expect(text).toBe(
      ['Daily Darts #12 🎯', '🟢 4  🟡 7  🔴 9', '20 darts', 'https://dailydarts.example'].join(
        '\n',
      ),
    )
  })

  it('gives away no targets or scores', () => {
    const s = summary([target(4, 'green'), target(7, 'yellow'), target(9, 'red')], 20)
    expect(buildShareText(1, s, 'https://x.example')).not.toContain('100')
  })
})
