import { describe, expect, it } from 'vitest'
import { BOARD_DARTS, MAX_CHECKOUT, dartLabel, findCheckout, isCheckout } from './checkout'
import { isLegalCheckoutRoute } from './test-helpers'

/** Scores 2-170 with no three-dart double-out finish ("bogey numbers"). */
const IMPOSSIBLE = [159, 162, 163, 165, 166, 168, 169]

const labels = (score: number) => findCheckout(score)?.map(dartLabel).join(' ')

describe('BOARD_DARTS', () => {
  it('has the 62 distinct scoring darts', () => {
    expect(BOARD_DARTS).toHaveLength(62)
    const keys = new Set(BOARD_DARTS.map(dartLabel))
    expect(keys.size).toBe(62)
  })
})

describe('findCheckout', () => {
  it('returns a legal route for every finishable score from 2 to 170', () => {
    for (let score = 2; score <= MAX_CHECKOUT; score++) {
      if (IMPOSSIBLE.includes(score)) continue
      const route = findCheckout(score)
      expect(route, `score ${score}`).not.toBeNull()
      expect(isLegalCheckoutRoute(score, route!), `score ${score}: ${labels(score)}`).toBe(true)
    }
  })

  it('returns null for the bogey numbers', () => {
    for (const score of IMPOSSIBLE) {
      expect(findCheckout(score), `score ${score}`).toBeNull()
    }
  })

  it('returns null for scores that can never be a checkout', () => {
    for (const score of [-1, 0, 1, 171, 180, 40.5, NaN, Infinity]) {
      expect(findCheckout(score), `score ${score}`).toBeNull()
    }
  })

  it('uses the fewest darts possible', () => {
    expect(labels(40)).toBe('D20')
    expect(labels(50)).toBe('Bull')
    expect(labels(2)).toBe('D1')
    expect(labels(101)).toBe('T17 Bull')
    expect(labels(110)).toBe('T20 Bull') // highest two-dart finish
    expect(findCheckout(111)).toHaveLength(3)
    expect(findCheckout(99)).toHaveLength(3) // lowest score needing three darts
  })

  it('finds the classic big finishes', () => {
    expect(labels(170)).toBe('T20 T20 Bull')
    expect(labels(167)).toBe('T20 T19 Bull')
    expect(labels(164)).toBe('T20 T18 Bull')
  })

  it('agrees with isCheckout', () => {
    for (let score = -5; score <= 200; score++) {
      expect(isCheckout(score)).toBe(findCheckout(score) !== null)
    }
  })
})
