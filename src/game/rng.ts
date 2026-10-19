/**
 * Seeded pseudo-random number generation for game logic.
 *
 * Everything here uses 32-bit integer arithmetic (Math.imul, >>>), which is
 * bit-for-bit identical across JS engines, so the browser and the server
 * produce the same sequence from the same seed.
 */

export type Rng = {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number
  /** Current internal state, so a round can be snapshotted and resumed. */
  state(): number
}

/** FNV-1a hash of a string to an unsigned 32-bit integer. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * mulberry32: small, fast, good enough for gameplay. A string seed is hashed
 * with FNV-1a first, so `createRng("2026-10-19:targets")` works directly.
 */
export function createRng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1))
    },
    state() {
      return a
    },
  }
}
