import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAUNCH_DATE } from '../game/puzzle'
import { replayRound } from '../game/round'
import { playRoundToFinish } from '../game/test-helpers'
import { rankedStatus, restoreRankedSteps, saveRankedInputs } from './progress'

/** A minimal in-memory localStorage. */
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  }
}

let storage: ReturnType<typeof memoryStorage>
beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

const date = LAUNCH_DATE
const finishing = playRoundToFinish(date)
const KEY = `daily-darts:round:${date}`

describe('ranked round persistence', () => {
  it('starts empty', () => {
    expect(restoreRankedSteps(date)).toEqual([])
    expect(rankedStatus(date)).toEqual({ status: 'new' })
  })

  it('resumes a partial round exactly where it was', () => {
    const partial = finishing.slice(0, 3)
    saveRankedInputs(date, partial)
    const steps = restoreRankedSteps(date)
    expect(steps.map((s) => s.throw.input)).toEqual(partial)
    expect(steps[steps.length - 1].state).toEqual(replayRound(date, partial))
    expect(rankedStatus(date)).toEqual({ status: 'in-progress', darts: 3 })
  })

  it('restores a finished round as finished', () => {
    saveRankedInputs(date, finishing)
    expect(rankedStatus(date)).toEqual({ status: 'finished', darts: finishing.length })
  })

  it('stores only the throw inputs', () => {
    saveRankedInputs(date, [{ lockX: 10, lockY: 20, extra: 'x' } as never])
    expect(JSON.parse(storage.data.get(KEY)!)).toEqual({
      version: 1,
      inputs: [{ lockX: 10, lockY: 20 }],
    })
  })

  it('keeps each day separate', () => {
    saveRankedInputs(date, finishing.slice(0, 2))
    expect(restoreRankedSteps('2026-11-02')).toEqual([])
  })

  it.each([
    ['unparseable JSON', '{nope'],
    ['an unknown version', JSON.stringify({ version: 99, inputs: [] })],
    ['inputs that are not throws', JSON.stringify({ version: 1, inputs: [{ x: 1 }] })],
    [
      'inputs that fail validation',
      JSON.stringify({ version: 1, inputs: [{ lockX: 9, lockY: 1 }] }),
    ],
  ])('discards a save with %s', (_, raw) => {
    storage.data.set(KEY, raw)
    expect(restoreRankedSteps(date)).toEqual([])
    expect(rankedStatus(date)).toEqual({ status: 'new' })
  })

  it('deletes a save that does not replay', () => {
    // Throws after the round already finished: the replay rejects it.
    storage.data.set(
      KEY,
      JSON.stringify({ version: 1, inputs: [...finishing, { lockX: 1, lockY: 2 }] }),
    )
    expect(restoreRankedSteps(date)).toEqual([])
    expect(storage.data.has(KEY)).toBe(false)
  })

  it('works (without saving) when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveRankedInputs(date, finishing)).not.toThrow()
    expect(restoreRankedSteps(date)).toEqual([])
  })
})
