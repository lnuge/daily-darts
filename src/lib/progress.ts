/**
 * Saving and restoring the ranked round in localStorage.
 *
 * Only the throw inputs are stored. The round is rebuilt by replaying them
 * with the same pure functions the server uses, so a restored round is
 * exactly what was played, and a corrupt or edited save that doesn't replay
 * is thrown away. Practice rounds are never saved.
 */

import { replaySteps, type ThrowStep } from '../game/round'
import type { ThrowInput } from '../game/throw'
import { loadJson, remove, saveJson } from './storage'

const VERSION = 1

type SavedRound = { version: typeof VERSION; inputs: ThrowInput[] }

export type RankedStatus =
  | { status: 'new' }
  | { status: 'in-progress'; darts: number }
  | { status: 'finished'; darts: number }

const keyFor = (date: string) => `round:${date}`

function isInputList(value: unknown): value is ThrowInput[] {
  return (
    Array.isArray(value) &&
    value.every(
      (input) =>
        typeof input === 'object' &&
        input !== null &&
        typeof input.lockX === 'number' &&
        typeof input.lockY === 'number',
    )
  )
}

export function saveRankedInputs(date: string, inputs: readonly ThrowInput[]): void {
  const saved: SavedRound = {
    version: VERSION,
    inputs: inputs.map(({ lockX, lockY }) => ({ lockX, lockY })),
  }
  saveJson(keyFor(date), saved)
}

/**
 * The saved ranked round for `date`, rebuilt step by step from its inputs.
 * Empty if there's no save, or if the save is unreadable or doesn't replay
 * (in which case it's deleted).
 */
export function restoreRankedSteps(date: string): ThrowStep[] {
  const saved = loadJson<SavedRound>(keyFor(date))
  if (saved === null) return []
  try {
    if (saved.version !== VERSION || !isInputList(saved.inputs)) {
      throw new Error('Unrecognised save')
    }
    return replaySteps(
      date,
      saved.inputs.map(({ lockX, lockY }) => ({ lockX, lockY })),
    )
  } catch {
    remove(keyFor(date))
    return []
  }
}

/** Whether the ranked round for `date` is untouched, under way or finished. */
export function rankedStatus(date: string): RankedStatus {
  const steps = restoreRankedSteps(date)
  const last = steps[steps.length - 1]
  if (!last) return { status: 'new' }
  return {
    status: last.state.finished ? 'finished' : 'in-progress',
    darts: last.state.totalDarts,
  }
}
