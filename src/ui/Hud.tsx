import type { MouseEvent } from 'react'
import { hitLabel, type Hit } from '../game/board'
import { dartLabel, findCheckout } from '../game/checkout'
import type { RoundState, RoundStep } from '../game/round'
import { splitVisits } from '../game/summary'

type Props = {
  round: RoundState
  steps: readonly RoundStep[]
  hintOn: boolean
  onToggleHint: () => void
  muted: boolean
  onToggleMute: () => void
}

/** Compact dart label for the visit slots. */
function slotLabel(hit: Hit): string {
  if (hit.multiplier === 0) return 'Miss'
  if (hit.segment === 25) return hit.multiplier === 2 ? 'Bull' : '25'
  return hitLabel(hit)
}

/** What just happened, in words. */
function message(round: RoundState, last: RoundStep | undefined): string {
  if (!last) return `Score ${round.remaining} to 0, finishing on a double.`
  const target = last.state.targets[last.targetIndex]
  if (last.targetDone === 'checkout') {
    return `Checkout! ${target.target} in ${target.darts} ${target.darts === 1 ? 'dart' : 'darts'}`
  }
  if (last.targetDone === 'capped') return `30-dart limit: ${target.target} counts as 30`
  if (last.outcome === 'bust') return `Bust! Back to ${last.state.remaining}`
  if (last.hit.multiplier === 0) return 'Miss'
  return `${hitLabel(last.hit)} · ${last.hit.points}`
}

/** Current target, remaining score, this visit's darts, total darts and the checkout hint. */
export function Hud({ round, steps, hintOn, onToggleHint, muted, onToggleMute }: Props) {
  const last = steps[steps.length - 1]
  // The darts currently on the board: the latest visit, ended or not.
  const visit = splitVisits(steps).at(-1)
  const slots = [0, 1, 2].map((i) => visit?.hits[i])
  const route = round.finished ? null : findCheckout(round.remaining)

  // After a mouse or touch click, drop focus so Space goes back to throwing.
  const clickThenBlur = (action: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    action()
    if (e.detail > 0) e.currentTarget.blur()
  }

  return (
    <div className="hud">
      <ol className="chips" aria-label="Targets">
        {round.targets.map((t, i) => {
          const state = t.outcome ? 'done' : i === round.current ? 'current' : 'upcoming'
          return (
            <li key={i} className={`chip ${state}`} aria-current={state === 'current' || undefined}>
              <span className="chip-target">{t.target}</span>
              {t.outcome && (
                <span className="chip-darts">
                  {t.outcome === 'checkout' ? '✓' : '✗'} {t.darts}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="hud-main">
        <div className="remaining">
          <span className="hud-label">Remaining</span>
          <span className="remaining-value">{round.finished ? '—' : round.remaining}</span>
        </div>
        <div className="hud-side">
          <div className="visit" aria-label={`Darts this visit: ${round.dartsThisVisit}`}>
            {slots.map((hit, i) => (
              <span key={i} className={`slot${hit ? ' filled' : ''}`}>
                {hit ? slotLabel(hit) : ''}
              </span>
            ))}
          </div>
          <span className="hud-label">
            Total <strong>{round.totalDarts}</strong> {round.totalDarts === 1 ? 'dart' : 'darts'}
          </span>
        </div>
      </div>

      <div className="hint-row">
        <button
          className={`toggle${hintOn ? ' on' : ''}`}
          aria-pressed={hintOn}
          onClick={clickThenBlur(onToggleHint)}
        >
          Hint
        </button>
        <span className="hint" aria-live="polite">
          {hintOn && !round.finished
            ? route
              ? route.map(dartLabel).join(' ')
              : 'No checkout yet: set one up'
            : ''}
        </span>
        <button
          className={`toggle sound${muted ? '' : ' on'}`}
          aria-pressed={!muted}
          aria-label="Sound"
          title={muted ? 'Sound off' : 'Sound on'}
          onClick={clickThenBlur(onToggleMute)}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <p className="message" aria-live="polite">
        {message(round, last)}
      </p>
    </div>
  )
}
