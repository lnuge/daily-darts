import type { MouseEvent } from 'react'
import { hitLabel, type Hit } from '../game/board'
import { dartLabel, findCheckout } from '../game/checkout'
import type { RoundState, RoundStep } from '../game/round'
import { splitVisits } from '../game/summary'
import { chalkedScores } from './scoreboard'

type Props = {
  round: RoundState
  steps: readonly RoundStep[]
  practiceDate?: string
  hintOn: boolean
  onToggleHint: () => void
  muted: boolean
  onToggleMute: () => void
  onMenu: () => void
}

/** How many crossed-out scores fit beside the current one. */
const CROSSED_SHOWN = 3

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

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="icon">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      {muted ? (
        <path d="M16 9.5l5 5m0-5l-5 5" />
      ) : (
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
      )}
    </svg>
  )
}

/**
 * The chalkboard: targets across the top, the score left with earlier ones
 * crossed off, this visit's darts, the checkout hint and what just happened.
 */
export function Hud(props: Props) {
  const { round, steps, practiceDate, hintOn, onToggleHint, muted, onToggleMute, onMenu } = props
  const last = steps[steps.length - 1]
  // The darts currently on the board: the latest visit, ended or not.
  const visit = splitVisits(steps).at(-1)
  const slots = [0, 1, 2].map((i) => visit?.hits[i])
  const route = round.finished ? null : findCheckout(round.remaining)
  // Mid-visit, the score the visit started on is crossed off too: the big
  // number is the live score.
  const scores = chalkedScores(steps, round)
  const crossed = round.dartsThisVisit > 0 ? scores : scores.slice(0, -1)

  // After a mouse or touch click, drop focus so Space goes back to throwing.
  const clickThenBlur = (action: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    action()
    if (e.detail > 0) e.currentTarget.blur()
  }

  return (
    <div className="hud">
      <div className="topbar">
        <button className="link back" onClick={onMenu}>
          ‹ Menu
        </button>
        {practiceDate && <p className="badge practice">Practice · {practiceDate}</p>}
        <button
          className="icon-button"
          aria-pressed={!muted}
          aria-label="Sound"
          title={muted ? 'Sound off' : 'Sound on'}
          onClick={clickThenBlur(onToggleMute)}
        >
          <SoundIcon muted={muted} />
        </button>
      </div>

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
          <span className="visually-hidden">Score left: </span>
          {crossed.length > CROSSED_SHOWN && <span className="crossed-more">…</span>}
          {crossed.slice(-CROSSED_SHOWN).map((score, i) => (
            <s key={crossed.length - CROSSED_SHOWN + i} className="crossed" aria-hidden="true">
              {score}
            </s>
          ))}
          <span className="remaining-value">{round.finished ? '—' : round.remaining}</span>
        </div>
        <div className="visit" aria-label={`Darts this visit: ${round.dartsThisVisit}`}>
          {slots.map((hit, i) => (
            <span key={i} className={`slot${hit ? ' filled' : ''}`}>
              {hit ? slotLabel(hit) : ''}
            </span>
          ))}
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
        <span className="hud-label">
          <strong>{round.totalDarts}</strong> {round.totalDarts === 1 ? 'dart' : 'darts'}
        </span>
      </div>

      <p className="message" aria-live="polite">
        {message(round, last)}
      </p>
    </div>
  )
}
