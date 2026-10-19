/**
 * Dartboard geometry and hit scoring. No rendering.
 *
 * Board coordinates: (0, 0) is the centre and radius 1 is the outer edge of
 * the double ring. Like the canvas, x grows to the right and y grows
 * DOWNWARD, so the 20 is at (0, -1) and the 6 is at (1, 0). Segments run
 * clockwise as seen on screen.
 *
 * Scoring decides results the server must reproduce, so it uses only
 * + - * and comparisons: no atan2, sin, cos or sqrt (see CLAUDE.md).
 */

/** Clockwise from the top. */
export const SEGMENT_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const

/**
 * Regulation dimensions in millimetres, measured from the centre to the
 * inside edge of each wire (WDF/BDO: inner bull 12.7 mm and outer bull
 * 31.8 mm diameter, treble and double rings 8 mm wide, 107 mm and 170 mm
 * to their outer edges).
 */
export const BOARD_MM = {
  bullseye: 6.35,
  outerBull: 15.9,
  tripleInner: 99,
  tripleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
} as const

/** The same radii in board units (double ring outer edge = 1). */
export const RADIUS = {
  bullseye: BOARD_MM.bullseye / BOARD_MM.doubleOuter,
  outerBull: BOARD_MM.outerBull / BOARD_MM.doubleOuter,
  tripleInner: BOARD_MM.tripleInner / BOARD_MM.doubleOuter,
  tripleOuter: BOARD_MM.tripleOuter / BOARD_MM.doubleOuter,
  doubleInner: BOARD_MM.doubleInner / BOARD_MM.doubleOuter,
  doubleOuter: 1,
} as const

/**
 * Unit vectors along the 20 radial wires. Wire k is at (18k - 9) degrees
 * clockwise from straight up, so segment SEGMENT_ORDER[k] lies between wire
 * k and wire k + 1. Written as literals (correctly rounded sin/cos values)
 * rather than computed, because Math.sin/cos may differ between engines.
 * Opposite wires are exact negations, so the board is exactly symmetric.
 */
export const WIRES: readonly (readonly [x: number, y: number])[] = [
  [-0.15643446504023087, -0.9876883405951378],
  [0.15643446504023087, -0.9876883405951378],
  [0.4539904997395468, -0.8910065241883679],
  [0.7071067811865476, -0.7071067811865476],
  [0.8910065241883679, -0.4539904997395468],
  [0.9876883405951378, -0.15643446504023087],
  [0.9876883405951378, 0.15643446504023087],
  [0.8910065241883679, 0.4539904997395468],
  [0.7071067811865476, 0.7071067811865476],
  [0.4539904997395468, 0.8910065241883679],
  [0.15643446504023087, 0.9876883405951378],
  [-0.15643446504023087, 0.9876883405951378],
  [-0.4539904997395468, 0.8910065241883679],
  [-0.7071067811865476, 0.7071067811865476],
  [-0.8910065241883679, 0.4539904997395468],
  [-0.9876883405951378, 0.15643446504023087],
  [-0.9876883405951378, -0.15643446504023087],
  [-0.8910065241883679, -0.4539904997395468],
  [-0.7071067811865476, -0.7071067811865476],
  [-0.4539904997395468, -0.8910065241883679],
]

export type HitMultiplier = 0 | 1 | 2 | 3

export type Hit = {
  /** 1-20, 25 for either bull, or 0 for a miss. */
  segment: number
  /** 0 for a miss; the bullseye is a double 25. */
  multiplier: HitMultiplier
  points: number
  /** True for the double ring and the bullseye (both count for double-out). */
  isDouble: boolean
}

const MISS: Hit = { segment: 0, multiplier: 0, points: 0, isDouble: false }

function hit(segment: number, multiplier: HitMultiplier): Hit {
  return { segment, multiplier, points: segment * multiplier, isDouble: multiplier === 2 }
}

/**
 * Positive when (x, y) is clockwise of the wire, zero when exactly on it.
 * (A 2D cross product; with y pointing down, positive means clockwise.)
 */
function sideOfWire(wire: readonly [number, number], x: number, y: number): number {
  return wire[0] * y - wire[1] * x
}

/** Which numbered segment the direction of (x, y) falls in. (x, y) must not be the centre. */
function segmentAt(x: number, y: number): number {
  for (let k = 0; k < WIRES.length; k++) {
    const next = WIRES[(k + 1) % WIRES.length]
    if (sideOfWire(WIRES[k], x, y) >= 0 && sideOfWire(next, x, y) < 0) return SEGMENT_ORDER[k]
  }
  // Unreachable: the 20 half-open sectors cover every direction.
  throw new Error(`No segment for (${x}, ${y})`)
}

/**
 * Scores a dart landing at (x, y) in board coordinates.
 *
 * Points exactly on a wire go to one side, consistently:
 * - on a ring wire, the region inside it (so radius exactly 1 is a double);
 * - on a radial wire, the segment clockwise of it (the 20/1 wire gives 1).
 * Anything outside the double ring, or a non-finite coordinate, is a miss.
 */
export function scoreHit(x: number, y: number): Hit {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return MISS

  const d2 = x * x + y * y
  if (d2 <= RADIUS.bullseye * RADIUS.bullseye) return hit(25, 2)
  if (d2 <= RADIUS.outerBull * RADIUS.outerBull) return hit(25, 1)
  if (d2 > RADIUS.doubleOuter * RADIUS.doubleOuter) return MISS

  const segment = segmentAt(x, y)
  if (d2 <= RADIUS.tripleInner * RADIUS.tripleInner) return hit(segment, 1)
  if (d2 <= RADIUS.tripleOuter * RADIUS.tripleOuter) return hit(segment, 3)
  if (d2 <= RADIUS.doubleInner * RADIUS.doubleInner) return hit(segment, 1)
  return hit(segment, 2)
}
