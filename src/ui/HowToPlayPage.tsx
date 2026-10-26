import type { Navigate } from './App'
import { HowToPlaySteps } from './HowToPlay'
import { RouteLink } from './RouteLink'

type Props = {
  today: string
  onNavigate: Navigate
}

/** The rules in full, at /how-to-play. */
export function HowToPlayPage({ today, onNavigate }: Props) {
  return (
    <section className="screen article">
      <div className="topbar">
        <button className="link back" onClick={() => onNavigate({ name: 'menu' })}>
          ‹ Menu
        </button>
      </div>
      <header className="title">
        <h1>How to play</h1>
        <p className="muted">One darts checkout puzzle a day</p>
      </header>

      <div className="article-body">
        <HowToPlaySteps />

        <h2>The board</h2>
        <p>
          It's a regulation dartboard. The thin outer ring is the <strong>doubles</strong> and the
          thin inner ring is the <strong>trebles</strong>; the wide beds between them score the
          number once. The green ring round the middle is the <strong>outer bull</strong> (25), and
          the red centre is the <strong>bullseye</strong> (50), which counts as a double, so you can
          finish on it.
        </p>

        <h2>Visits and busts</h2>
        <p>
          You throw in visits of three darts. If a dart takes you below zero, leaves you on one, or
          reaches zero without a double, that's a bust: the score goes back to where the visit
          started and the visit ends, but the darts still count. After 30 darts a target ends anyway
          and counts as 30.
        </p>

        <h2>Par</h2>
        <p>
          Par for a target is the fewest darts that can possibly finish it, plus three. Your result
          shows a green dot at or under par, yellow for up to three over, and red beyond that. The
          share text shows only those dots and dart counts, never the targets, so it won't spoil the
          puzzle for anyone.
        </p>

        <h2>Tips</h2>
        <ul>
          <li>
            Aim to leave yourself an even number you can halve: 32 is double 16, 40 is double 20.
          </li>
          <li>Keep away from one: it can't be finished, so leaving it is a bust.</li>
          <li>
            Turn on the hint for a suggested route from any score. It updates after every dart.
          </li>
          <li>
            Missed a day? Every past puzzle is in the{' '}
            <RouteLink to={{ name: 'archive' }} onNavigate={onNavigate}>
              archive
            </RouteLink>
            , and you can replay any of them for practice.
          </li>
        </ul>
      </div>

      <div className="actions">
        <button
          className="primary"
          onClick={() => onNavigate({ name: 'game', mode: 'ranked', date: today })}
        >
          Play today's puzzle
        </button>
        <RouteLink to={{ name: 'leaderboard' }} onNavigate={onNavigate} className="link">
          Leaderboard
        </RouteLink>
      </div>
    </section>
  )
}
