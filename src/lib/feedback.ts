/**
 * What the player should hear and see when a dart lands. Pure, so it can be
 * tested; the UI plays the sounds and runs the effects.
 */

import type { RoundStep } from '../game/round'
import type { SoundName } from './sound'

export type Feedback = {
  /** Sounds and their delays, in ms after the dart lands. */
  sounds: { name: SoundName; delayMs: number }[]
  /** Screen shake and the "CHECKOUT!" flash: only when a target is finished. */
  celebrate: boolean
}

export function feedbackFor(step: RoundStep): Feedback {
  const sounds: Feedback['sounds'] = [
    { name: step.hit.multiplier === 0 ? 'miss' : 'hit', delayMs: 0 },
  ]
  if (step.targetDone === 'checkout') {
    sounds.push({ name: 'checkout', delayMs: 90 })
  } else if (step.outcome === 'bust' || step.targetDone === 'capped') {
    sounds.push({ name: 'bust', delayMs: 120 })
  }
  return { sounds, celebrate: step.targetDone === 'checkout' }
}
