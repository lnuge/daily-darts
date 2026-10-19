/** Helpers for tests only. Not imported by app code. */

import type { Dart } from './checkout'

/**
 * Independent of the solver: is `route` a legal double-out finish for `score`?
 */
export function isLegalCheckoutRoute(score: number, route: readonly Dart[]): boolean {
  if (route.length < 1 || route.length > 3) return false
  for (const { segment, multiplier } of route) {
    const isNumber = Number.isInteger(segment) && segment >= 1 && segment <= 20
    const isBull = segment === 25
    if (!isNumber && !isBull) return false
    if (isNumber && ![1, 2, 3].includes(multiplier)) return false
    if (isBull && ![1, 2].includes(multiplier)) return false // no treble bull
  }
  if (route[route.length - 1].multiplier !== 2) return false
  return route.reduce((sum, d) => sum + d.segment * d.multiplier, 0) === score
}
