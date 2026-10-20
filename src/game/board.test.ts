import { describe, expect, it } from 'vitest'
import { RADIUS, WIRES, hitLabel, scoreHit } from './board'

/**
 * Board point at `degrees` clockwise from straight up and radius `r`.
 * Test-only: Math.sin/cos are fine here since we aim well clear of wires.
 */
function polar(degrees: number, r: number): [number, number] {
  const t = (degrees * Math.PI) / 180
  return [r * Math.sin(t), -r * Math.cos(t)]
}

/**
 * A real board, clockwise from the top. Kept separate from SEGMENT_ORDER so
 * the tests check the module against the real thing, not against itself.
 */
const REAL_BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

/** Centre angle of a numbered segment on a real board. */
function angleOf(segment: number): number {
  return 18 * REAL_BOARD.indexOf(segment)
}

const score = (x: number, y: number) => scoreHit(x, y)
const label = (x: number, y: number) => {
  const { segment, multiplier } = scoreHit(x, y)
  if (multiplier === 0) return 'miss'
  if (segment === 25) return multiplier === 2 ? 'Bull' : '25'
  return `${'SDT'[multiplier - 1]}${segment}`
}

describe('scoreHit: bulls', () => {
  it('scores the bullseye as a double 25 worth 50', () => {
    expect(score(0, 0)).toEqual({ segment: 25, multiplier: 2, points: 50, isDouble: true })
    expect(label(...polar(123, RADIUS.bullseye * 0.9))).toBe('Bull')
  })

  it('scores the outer bull as a single 25', () => {
    expect(score(0.06, 0)).toEqual({ segment: 25, multiplier: 1, points: 25, isDouble: false })
    expect(label(...polar(300, RADIUS.outerBull * 0.9))).toBe('25')
  })
})

describe('scoreHit: numbered segments', () => {
  it('scores treble 20', () => {
    expect(score(0, -0.6)).toEqual({ segment: 20, multiplier: 3, points: 60, isDouble: false })
  })

  it('scores double 16', () => {
    const r = (RADIUS.doubleInner + RADIUS.doubleOuter) / 2
    expect(score(...polar(angleOf(16), r))).toEqual({
      segment: 16,
      multiplier: 2,
      points: 32,
      isDouble: true,
    })
  })

  it('puts every segment where a real board has it', () => {
    // Spot checks against a physical board (y is down: 3 is at the bottom).
    expect(label(0.8, 0)).toBe('S6')
    expect(label(0, 0.8)).toBe('S3')
    expect(label(-0.8, 0)).toBe('S11')
    for (const segment of REAL_BOARD) {
      const angle = angleOf(segment)
      expect(label(...polar(angle, 0.3)), `${segment} inner single`).toBe(`S${segment}`)
      expect(label(...polar(angle, 0.6)), `${segment} treble`).toBe(`T${segment}`)
      expect(label(...polar(angle, 0.8)), `${segment} outer single`).toBe(`S${segment}`)
      expect(label(...polar(angle, 0.97)), `${segment} double`).toBe(`D${segment}`)
    }
  })

  it('meets each segment exactly once going round, in board order', () => {
    const seen: number[] = []
    for (let i = 0; i < 7200; i++) {
      const { segment } = score(...polar(-8.99 + i * 0.05, 0.8))
      if (seen[seen.length - 1] !== segment) seen.push(segment)
    }
    expect(seen).toEqual(REAL_BOARD)
  })

  it('reports points and isDouble consistently', () => {
    for (let i = 0; i < 2000; i++) {
      const h = score(...polar(i * 0.37, (i % 107) / 100))
      expect(h.points).toBe(h.segment * h.multiplier)
      expect(h.isDouble).toBe(h.multiplier === 2)
    }
  })
})

describe('scoreHit: misses', () => {
  it('scores 0 outside the double ring', () => {
    const miss = { segment: 0, multiplier: 0, points: 0, isDouble: false }
    expect(score(0, -1.01)).toEqual(miss)
    expect(score(0.8, 0.8)).toEqual(miss)
    expect(score(-50, 3)).toEqual(miss)
    expect(score(0, -(1 + Number.EPSILON))).toEqual(miss)
  })

  it('treats non-finite coordinates as a miss', () => {
    expect(label(NaN, 0)).toBe('miss')
    expect(label(0, Infinity)).toBe('miss')
  })
})

describe('scoreHit: points exactly on wires', () => {
  it('gives a ring wire to the region inside it', () => {
    expect(label(0, -RADIUS.bullseye)).toBe('Bull')
    expect(label(0, -RADIUS.outerBull)).toBe('25')
    expect(label(0, -RADIUS.tripleInner)).toBe('S20')
    expect(label(0, -RADIUS.tripleOuter)).toBe('T20')
    expect(label(0, -RADIUS.doubleInner)).toBe('S20')
    expect(label(0, -1)).toBe('D20')
    expect(label(1, 0)).toBe('D6')
  })

  it('switches region just past each ring wire', () => {
    const past = (r: number) => -(r * (1 + 1e-12))
    expect(label(0, past(RADIUS.bullseye))).toBe('25')
    expect(label(0, past(RADIUS.outerBull))).toBe('S20')
    expect(label(0, past(RADIUS.tripleInner))).toBe('T20')
    expect(label(0, past(RADIUS.tripleOuter))).toBe('S20')
    expect(label(0, past(RADIUS.doubleInner))).toBe('D20')
  })

  it('gives a radial wire to the segment clockwise of it', () => {
    // Halving a wire's unit vector is exact, so these points lie exactly on it.
    WIRES.forEach((wire, k) => {
      const clockwise = REAL_BOARD[k]
      expect(score(wire[0] * 0.5, wire[1] * 0.5).segment, `wire ${k}`).toBe(clockwise)
      expect(score(wire[0] * 0.25, wire[1] * 0.25).segment, `wire ${k}`).toBe(clockwise)
    })
    // Named example: the wire between 20 and 1.
    expect(label(WIRES[1][0] * 0.5, WIRES[1][1] * 0.5)).toBe('S1')
  })

  it('switches segment either side of a radial wire', () => {
    expect(label(...polar(9 - 1e-9, 0.5))).toBe('S20')
    expect(label(...polar(9 + 1e-9, 0.5))).toBe('S1')
    expect(label(...polar(-9 - 1e-9, 0.5))).toBe('S5')
    expect(label(...polar(-9 + 1e-9, 0.5))).toBe('S20')
  })
})

describe('board geometry', () => {
  it('uses regulation proportions', () => {
    expect(RADIUS.bullseye).toBeCloseTo(6.35 / 170, 15)
    expect(RADIUS.outerBull).toBeCloseTo(15.9 / 170, 15)
    expect(RADIUS.tripleOuter - RADIUS.tripleInner).toBeCloseTo(8 / 170, 15)
    expect(RADIUS.doubleOuter - RADIUS.doubleInner).toBeCloseTo(8 / 170, 15)
  })

  it('has wire vectors that are unit length, 18 degrees apart and exactly symmetric', () => {
    WIRES.forEach(([x, y], k) => {
      // The literals are correctly rounded; Math.sin/cos of a converted angle
      // can be a few ulps off, hence 14 digits rather than 15.
      const [ex, ey] = polar(18 * k - 9, 1)
      expect(x).toBeCloseTo(ex, 14)
      expect(y).toBeCloseTo(ey, 14)
      expect(x * x + y * y).toBeCloseTo(1, 15)
      const [ox, oy] = WIRES[(k + 10) % 20]
      expect(ox).toBe(-x)
      expect(oy).toBe(-y)
    })
  })
})

describe('hitLabel', () => {
  it('names each kind of hit', () => {
    expect(hitLabel(scoreHit(0, 0))).toBe('Bull')
    expect(hitLabel(scoreHit(0.06, 0))).toBe('Outer bull')
    expect(hitLabel(scoreHit(0, -0.6))).toBe('T20')
    expect(hitLabel(scoreHit(0, 0.97))).toBe('D3')
    expect(hitLabel(scoreHit(0.8, 0))).toBe('S6')
    expect(hitLabel(scoreHit(2, 2))).toBe('Miss')
  })
})
