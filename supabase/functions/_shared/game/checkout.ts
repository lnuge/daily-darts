// GENERATED from src/game/checkout.ts by scripts/sync-shared-game.mjs. Do not edit.
// Change src/game/checkout.ts, then run: npm run sync:game

/**
 * Double-out checkouts: reaching exactly zero within three darts, where the
 * last dart is a double (the bullseye counts as a double 25).
 */

export type Multiplier = 1 | 2 | 3

/** `segment` is 1-20, or 25 for the bull (single 25 = outer bull, double 25 = bullseye). */
export type Dart = { segment: number; multiplier: Multiplier }

/** Highest possible checkout: T20 T20 Bull. */
export const MAX_CHECKOUT = 170

export function dartValue(dart: Dart): number {
  return dart.segment * dart.multiplier
}

/** "T20", "D16", "S5", "Bull" (50) or "25". */
export function dartLabel(dart: Dart): string {
  if (dart.segment === 25) return dart.multiplier === 2 ? 'Bull' : '25'
  return `${'SDT'[dart.multiplier - 1]}${dart.segment}`
}

function buildBoard(): Dart[] {
  const darts: Dart[] = []
  for (let segment = 20; segment >= 1; segment--) {
    darts.push({ segment, multiplier: 3 }, { segment, multiplier: 2 }, { segment, multiplier: 1 })
  }
  darts.push({ segment: 25, multiplier: 2 }, { segment: 25, multiplier: 1 })
  // Highest value first, trebles before doubles before singles on ties, so the
  // solver prefers the conventional routes (e.g. 170 = T20 T20 Bull). Ties
  // beyond that keep insertion order; Array.prototype.sort is stable.
  return darts.sort((a, b) => dartValue(b) - dartValue(a) || b.multiplier - a.multiplier)
}

/** Every distinct scoring dart on the board (62 of them). */
export const BOARD_DARTS: readonly Dart[] = buildBoard()

const FINISHING_DOUBLES = BOARD_DARTS.filter((dart) => dart.multiplier === 2)

function search(remaining: number, dartsLeft: number): Dart[] | null {
  if (dartsLeft === 1) {
    const double = FINISHING_DOUBLES.find((dart) => dartValue(dart) === remaining)
    return double ? [double] : null
  }
  for (const dart of BOARD_DARTS) {
    const rest = remaining - dartValue(dart)
    // Need at least 2 left for the finishing double.
    if (rest < 2) continue
    const tail = search(rest, dartsLeft - 1)
    if (tail) return [dart, ...tail]
  }
  return null
}

function solve(score: number): Dart[] | null {
  for (let darts = 1; darts <= 3; darts++) {
    const route = search(score, darts)
    if (route) return route
  }
  return null
}

/** Index = score. Built once: the search is slow for impossible scores like 159. */
const CHECKOUT_TABLE: readonly (readonly Dart[] | null)[] = Array.from(
  { length: MAX_CHECKOUT + 1 },
  (_, score) => (score < 2 ? null : solve(score)),
)

/**
 * A fewest-darts route (at most three) that checks out `score`, or null if
 * there isn't one. Always returns the same route for a score.
 */
export function findCheckout(score: number): readonly Dart[] | null {
  if (!Number.isInteger(score) || score < 0 || score > MAX_CHECKOUT) return null
  return CHECKOUT_TABLE[score]
}

export function isCheckout(score: number): boolean {
  return findCheckout(score) !== null
}
