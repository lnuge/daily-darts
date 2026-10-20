import { describe, expect, it } from 'vitest'
import { hitLabel, scoreHit } from './board.ts'
import { addDays } from './date.ts'
import { LAUNCH_DATE, WOBBLE_RANGE, generateDailyPuzzle, type DailyPuzzle } from './puzzle.ts'
import { createRng } from './rng.ts'
import {
  MAX_THROW_MS,
  SWEEP_EXTENT,
  aimPoint,
  randomInUnitDisc,
  resolveThrow,
  sweepPosition,
  validateThrowInput,
  type ThrowInput,
} from './throw.ts'

const launch = generateDailyPuzzle(LAUNCH_DATE)

/** A real day's puzzle with the sweep speed and wobble overridden. */
function puzzleWith(overrides: Partial<DailyPuzzle>, date = LAUNCH_DATE): DailyPuzzle {
  return { ...generateDailyPuzzle(date), ...overrides }
}

/** A spread of plausible inputs: first tap 0-3s in, second 0-3s after that. */
function sampleInputs(count: number): ThrowInput[] {
  const rng = createRng('throw-test-inputs')
  return Array.from({ length: count }, () => {
    const lockX = rng.int(0, 3000)
    return { lockX, lockY: lockX + rng.int(0, 3000) }
  })
}

describe('sweepPosition', () => {
  it('sweeps edge to edge and back at one pass per second at speed 1', () => {
    expect(sweepPosition(0, 1)).toBe(-SWEEP_EXTENT)
    expect(sweepPosition(250, 1)).toBe(-SWEEP_EXTENT / 2)
    expect(sweepPosition(500, 1)).toBe(0)
    expect(sweepPosition(1000, 1)).toBe(SWEEP_EXTENT)
    expect(sweepPosition(1500, 1)).toBe(0)
    expect(sweepPosition(2000, 1)).toBe(-SWEEP_EXTENT)
    expect(sweepPosition(2500, 1)).toBe(0)
  })

  it('scales with sweep speed', () => {
    expect(sweepPosition(2000, 0.5)).toBe(SWEEP_EXTENT) // one pass in 2s
    expect(sweepPosition(2500, 1.2)).toBe(SWEEP_EXTENT) // 3 passes in 2.5s
    expect(sweepPosition(1000, 0.6)).toBeCloseTo(SWEEP_EXTENT * 0.2, 12)
  })

  it('moves at a constant speed and never leaves the sweep range', () => {
    for (const speed of [0.6, 0.83, 1, 1.2]) {
      const maxStep = (2 * SWEEP_EXTENT * speed) / 1000 + 1e-12
      let previous = sweepPosition(0, speed)
      for (let t = 1; t <= 10_000; t++) {
        const position = sweepPosition(t, speed)
        expect(Math.abs(position)).toBeLessThanOrEqual(SWEEP_EXTENT)
        expect(Math.abs(position - previous)).toBeLessThanOrEqual(maxStep)
        previous = position
      }
    }
  })

  it('treats negative time as the start', () => {
    expect(sweepPosition(-50, 1)).toBe(-SWEEP_EXTENT)
  })
})

describe('aimPoint', () => {
  it('starts the vertical sweep when X locks', () => {
    expect(aimPoint({ lockX: 500, lockY: 500 }, 1)).toEqual({ x: 0, y: -SWEEP_EXTENT })
    expect(aimPoint({ lockX: 500, lockY: 1000 }, 1)).toEqual({ x: 0, y: 0 })
    expect(aimPoint({ lockX: 0, lockY: 1000 }, 1)).toEqual({ x: -SWEEP_EXTENT, y: SWEEP_EXTENT })
  })
})

describe('validateThrowInput', () => {
  it('accepts whole-millisecond taps in order', () => {
    expect(() => validateThrowInput({ lockX: 0, lockY: 0 })).not.toThrow()
    expect(() => validateThrowInput({ lockX: 812, lockY: 1460 })).not.toThrow()
    expect(() => validateThrowInput({ lockX: MAX_THROW_MS, lockY: MAX_THROW_MS })).not.toThrow()
  })

  it.each([
    { lockX: 1.5, lockY: 10 },
    { lockX: 10, lockY: NaN },
    { lockX: -1, lockY: 10 },
    { lockX: 10, lockY: 9 },
    { lockX: 0, lockY: MAX_THROW_MS + 1 },
    { lockX: 0, lockY: Infinity },
  ])('rejects %j', (input) => {
    expect(() => validateThrowInput(input)).toThrow()
    expect(() => resolveThrow(launch, input)).toThrow()
  })
})

describe('randomInUnitDisc', () => {
  it('stays in the unit disc and spreads evenly over it', () => {
    const rng = createRng('disc')
    let inner = 0
    let sumX = 0
    let sumY = 0
    const n = 20_000
    for (let i = 0; i < n; i++) {
      const { x, y } = randomInUnitDisc(rng)
      expect(x * x + y * y).toBeLessThanOrEqual(1)
      if (x * x + y * y <= 0.25) inner++
      sumX += x
      sumY += y
    }
    // Uniform over area: a quarter of points fall within radius 0.5.
    expect(inner / n).toBeGreaterThan(0.24)
    expect(inner / n).toBeLessThan(0.26)
    expect(Math.abs(sumX / n)).toBeLessThan(0.02)
    expect(Math.abs(sumY / n)).toBeLessThan(0.02)
  })
})

describe('resolveThrow', () => {
  it('gives the same landing every time for the same day and taps', () => {
    const inputs = sampleInputs(500)
    const first = inputs.map((input) => resolveThrow(launch, input))
    // Different order, fresh calls: no hidden state carries between throws.
    const again = [...inputs].reverse().map((input) => resolveThrow(launch, input))
    expect(again.reverse()).toEqual(first)
  })

  it('replays a recorded round exactly', () => {
    // Pinned: if this changes, recorded throws no longer replay the same.
    const round: ThrowInput[] = [
      { lockX: 812, lockY: 1460 },
      { lockX: 1203, lockY: 1950 },
      { lockX: 455, lockY: 2101 },
    ]
    const replay = round.map((input) => {
      const { landing, hit } = resolveThrow(launch, input)
      return { input, landing, hit: hitLabel(hit), points: hit.points }
    })
    expect(replay).toMatchInlineSnapshot(`
      [
        {
          "hit": "S10",
          "input": {
            "lockX": 812,
            "lockY": 1460,
          },
          "landing": {
            "x": 0.39673363249254234,
            "y": 0.08129758701133726,
          },
          "points": 10,
        },
        {
          "hit": "Miss",
          "input": {
            "lockX": 1203,
            "lockY": 1950,
          },
          "landing": {
            "x": 1.114234212514639,
            "y": 0.2768051638902425,
          },
          "points": 0,
        },
        {
          "hit": "S7",
          "input": {
            "lockX": 455,
            "lockY": 2101,
          },
          "landing": {
            "x": -0.2633115839493275,
            "y": 0.2748624552496673,
          },
          "points": 7,
        },
      ]
    `)
  })

  it('scatters within the wobble radius of the aim point', () => {
    for (const input of sampleInputs(2000)) {
      const { aim, landing } = resolveThrow(launch, input)
      const dx = landing.x - aim.x
      const dy = landing.y - aim.y
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(launch.wobble * launch.wobble + 1e-15)
    }
  })

  it('actually scatters, in every direction', () => {
    const offsets = sampleInputs(200).map((input) => {
      const { aim, landing } = resolveThrow(launch, input)
      return { dx: landing.x - aim.x, dy: landing.y - aim.y }
    })
    expect(offsets.filter(({ dx, dy }) => dx === 0 && dy === 0)).toHaveLength(0)
    expect(offsets.some(({ dx }) => dx > 0)).toBe(true)
    expect(offsets.some(({ dx }) => dx < 0)).toBe(true)
    expect(offsets.some(({ dy }) => dy > 0)).toBe(true)
    expect(offsets.some(({ dy }) => dy < 0)).toBe(true)
  })

  it('scatters differently for a tap one millisecond later', () => {
    const a = resolveThrow(launch, { lockX: 800, lockY: 1500 })
    const b = resolveThrow(launch, { lockX: 800, lockY: 1501 })
    const offsetA = [a.landing.x - a.aim.x, a.landing.y - a.aim.y]
    const offsetB = [b.landing.x - b.aim.x, b.landing.y - b.aim.y]
    expect(offsetB).not.toEqual(offsetA)
  })

  it('scatters differently on a different day', () => {
    const input = { lockX: 800, lockY: 1500 }
    const day1 = resolveThrow(puzzleWith({ sweepSpeed: 1, wobble: 0.03 }, '2026-11-01'), input)
    const day2 = resolveThrow(puzzleWith({ sweepSpeed: 1, wobble: 0.03 }, '2026-11-02'), input)
    expect(day1.aim).toEqual(day2.aim)
    expect(day1.landing).not.toEqual(day2.landing)
  })

  it('scores exactly where the dart landed', () => {
    for (const input of sampleInputs(500)) {
      const { landing, hit } = resolveThrow(launch, input)
      expect(hit).toEqual(scoreHit(landing.x, landing.y))
    }
  })

  it('cannot leave the bull when aimed dead centre, even at maximum wobble', () => {
    // Speed 1: x crosses the centre at 500 ms, then y does 500 ms after that.
    for (let i = 0; i < 365; i++) {
      const puzzle = puzzleWith(
        { sweepSpeed: 1, wobble: WOBBLE_RANGE.max },
        addDays(LAUNCH_DATE, i),
      )
      const { aim, hit } = resolveThrow(puzzle, { lockX: 500, lockY: 1000 })
      expect(aim).toEqual({ x: 0, y: 0 })
      expect(hit.segment).toBe(25)
    }
  })

  it('scores treble 20 for a well-timed throw with low wobble', () => {
    // Speed 1: x = 0 at 500 ms; y is about -0.6 (mid treble) 227 ms later.
    const puzzle = puzzleWith({ sweepSpeed: 1, wobble: WOBBLE_RANGE.min })
    const { hit } = resolveThrow(puzzle, { lockX: 500, lockY: 727 })
    expect(hitLabel(hit)).toBe('T20')
    expect(hit.points).toBe(60)
  })
})
