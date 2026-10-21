import type { RoundState, RoundStep } from '../game/round'
import { splitVisits } from '../game/summary'

/**
 * The scores chalked up for the target in play, like a pub scoreboard: the
 * target, then the score left after each finished visit, oldest first. A bust
 * writes the same score again. The last entry is where the current visit
 * started. Empty once the round is finished.
 */
export function chalkedScores(steps: readonly RoundStep[], round: RoundState): number[] {
  if (round.finished) return []
  const scores = [round.targets[round.current].target]
  for (const visit of splitVisits(steps)) {
    if (visit.targetIndex !== round.current || visit.end === 'open') continue
    // A bust visit scores 0 points.
    scores.push(scores[scores.length - 1] - visit.points)
  }
  return scores
}
