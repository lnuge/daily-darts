import { useMemo } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import { rankedStatus } from '../lib/progress'
import type { Navigate } from './App'
import { AccountBar } from './AccountBar'
import { BoardCanvas } from './BoardCanvas'
import { LegalLinks } from './LegalScreen'

type Props = {
  today: string
  onNavigate: Navigate
  onHowToPlay: () => void
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

export function MenuScreen({ today, onNavigate, onHowToPlay }: Props) {
  const status = useMemo(() => rankedStatus(today), [today])
  const puzzle = useMemo(() => generateDailyPuzzle(today), [today])
  const play = () => onNavigate({ name: 'game', mode: 'ranked', date: today })

  return (
    <section className="screen menu">
      <header className="masthead">
        <h1 className="wordmark">Daily Darts</h1>
        <p className="muted">
          {puzzle.puzzleNumber >= 0 && <>No. {puzzle.puzzleNumber} · </>}
          {longDate(today)}
        </p>
      </header>

      <div className="board-frame">
        <BoardCanvas />
      </div>

      <div className="specials" aria-label="Today's checkouts">
        <span className="specials-label">Today's checkouts</span>
        <span className="specials-targets">
          {puzzle.targets.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
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
        <button className="link" onClick={() => onNavigate({ name: 'practice' })}>
          Practice
        </button>
        <button className="link" onClick={() => onNavigate({ name: 'leaderboard' })}>
          Leaderboard
        </button>
        <button className="link" onClick={() => onNavigate({ name: 'profile' })}>
          Profile
        </button>
        <button className="link" onClick={onHowToPlay}>
          How to play
        </button>
      </nav>

      <AccountBar />
      <LegalLinks onNavigate={onNavigate} />
    </section>
  )
}
