import { useMemo } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import { rankedStatus } from '../lib/progress'
import { AboutDailyDarts } from './AboutDailyDarts'
import type { Navigate } from './App'
import { AccountBar } from './AccountBar'
import { BoardCanvas } from './BoardCanvas'
import { LegalLinks } from './LegalScreen'
import { RouteLink } from './RouteLink'

type Props = {
  today: string
  onNavigate: Navigate
  /**
   * Built ahead of time as a static page (src/prerender): leave out what's
   * only true on the day it was built (the date and today's checkouts). The
   * app fills them in when it starts.
   */
  prerendered?: boolean
}

/** "Tuesday 21 October", in the player's own language. */
function longDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function MenuScreen({ today, onNavigate, prerendered = false }: Props) {
  const status = useMemo(() => rankedStatus(today), [today])
  const puzzle = useMemo(() => generateDailyPuzzle(today), [today])
  const play = () => onNavigate({ name: 'game', mode: 'ranked', date: today })

  return (
    <section className="screen menu">
      <header className="masthead">
        <h1 className="wordmark">Daily Darts</h1>
        <p className="muted">
          {prerendered ? (
            'A new darts checkout puzzle every day'
          ) : (
            <>
              {puzzle.puzzleNumber >= 0 && <>No. {puzzle.puzzleNumber} · </>}
              {longDate(today)}
            </>
          )}
        </p>
      </header>

      <div className="board-frame">
        <BoardCanvas />
      </div>

      <div className="specials" aria-label="Today's checkouts">
        <span className="specials-label">Today's checkouts</span>
        <span className="specials-targets">
          {prerendered ? (
            <span aria-hidden="true">? · ? · ?</span>
          ) : (
            puzzle.targets.map((t, i) => <span key={i}>{t}</span>)
          )}
        </span>
      </div>

      <button className="primary big" onClick={play}>
        {status.status === 'finished'
          ? "Today's results"
          : status.status === 'in-progress'
            ? `Resume · ${status.darts} ${status.darts === 1 ? 'dart' : 'darts'}`
            : 'Play'}
      </button>

      <nav className="menu-links" aria-label="More">
        <RouteLink to={{ name: 'leaderboard' }} onNavigate={onNavigate} className="link">
          Leaderboard
        </RouteLink>
        <RouteLink to={{ name: 'archive' }} onNavigate={onNavigate} className="link">
          Archive
        </RouteLink>
        <RouteLink to={{ name: 'practice' }} onNavigate={onNavigate} className="link">
          Practice
        </RouteLink>
        <RouteLink to={{ name: 'profile' }} onNavigate={onNavigate} className="link">
          Profile
        </RouteLink>
        <RouteLink to={{ name: 'howToPlay' }} onNavigate={onNavigate} className="link">
          How to play
        </RouteLink>
      </nav>

      <AccountBar onNavigate={onNavigate} />
      <AboutDailyDarts onNavigate={onNavigate} />
      <LegalLinks onNavigate={onNavigate} />
    </section>
  )
}
