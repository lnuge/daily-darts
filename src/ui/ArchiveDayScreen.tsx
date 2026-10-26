import { useEffect, useState } from 'react'
import { dartLabel, findCheckout } from '../game/checkout'
import { addDays } from '../game/date'
import { generateDailyPuzzle } from '../game/puzzle'
import { targetPar } from '../game/summary'
import { ARCHIVE_TOP, isArchived } from '../lib/archive'
import { formatLongDate, formatShortDate } from '../lib/daily'
import { fetchLeaderboard, type Leaderboard } from '../lib/leaderboard'
import { supabase } from '../lib/supabase'
import type { Navigate } from './App'
import { RouteLink } from './RouteLink'

/** Top scores, or 'unavailable' if they couldn't be loaded. */
export type ArchiveScores = Leaderboard | 'unavailable'

type Props = {
  date: string
  onNavigate: Navigate
  /** The moment to judge "archived yet?" at; prerendered pages pass the build time. */
  nowMs?: number
  /** Top scores to show without fetching (an archived day's scores are final). */
  initial?: ArchiveScores
}

const LEVELS = ['Easy', 'Medium', 'Hard'] as const

/** One past puzzle: its targets, best possible finishes and top scores. */
export function ArchiveDayScreen({ date, onNavigate, nowMs, initial }: Props) {
  const [now] = useState(() => nowMs ?? Date.now())
  const archived = isArchived(date, now)
  const { puzzleNumber, targets } = generateDailyPuzzle(date)
  const [fetched, setFetched] = useState<ArchiveScores | null>(null)
  const scores = initial ?? (supabase ? fetched : 'unavailable')

  useEffect(() => {
    if (initial !== undefined || !archived || !supabase) return
    let current = true
    fetchLeaderboard(date, ARCHIVE_TOP).then(
      (board) => current && setFetched(board),
      () => current && setFetched('unavailable'),
    )
    return () => {
      current = false
    }
  }, [date, archived, initial])

  const prev = addDays(date, -1)
  const next = addDays(date, 1)

  return (
    <section className="screen article archive-day">
      <div className="topbar">
        <RouteLink to={{ name: 'archive' }} onNavigate={onNavigate} className="link back">
          ‹ Archive
        </RouteLink>
      </div>
      <header className="title">
        <h1>{puzzleNumber >= 0 ? `Daily Darts #${puzzleNumber}` : 'Daily Darts'}</h1>
        <p className="muted">{formatLongDate(date)}</p>
      </header>

      {!archived ? (
        <p className="page-note">
          This puzzle is still being played somewhere in the world. Its page opens once it has
          closed everywhere, so nobody's puzzle gets spoiled.
        </p>
      ) : (
        <>
          <section className="archive-section" aria-labelledby="checkouts-title">
            <h2 id="checkouts-title">The checkouts</h2>
            <ol className="archive-targets-list">
              {targets.map((target, i) => {
                const route = findCheckout(target) ?? []
                return (
                  <li key={i}>
                    <span className="archive-level">{LEVELS[i]}</span>
                    <span className="archive-target">{target}</span>
                    <span className="archive-route">
                      Best: {route.length} {route.length === 1 ? 'dart' : 'darts'},{' '}
                      {route.map(dartLabel).join(' ')}
                    </span>
                    <span className="muted archive-par">Par {targetPar(target)}</span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="archive-section" aria-labelledby="top-title">
            <h2 id="top-title">Top scores</h2>
            <TopScores scores={scores} />
            <RouteLink to={{ name: 'leaderboard', date }} onNavigate={onNavigate} className="link">
              Full leaderboard
            </RouteLink>
          </section>

          <button
            className="primary"
            onClick={() => onNavigate({ name: 'game', mode: 'practice', date })}
          >
            Play this puzzle
          </button>
        </>
      )}

      <nav className="archive-pager" aria-label="Other days">
        {isArchived(prev, now) ? (
          <RouteLink
            to={{ name: 'archiveDay', date: prev }}
            onNavigate={onNavigate}
            className="link"
          >
            ‹ {formatShortDate(prev)}
          </RouteLink>
        ) : (
          <span />
        )}
        {isArchived(next, now) && (
          <RouteLink
            to={{ name: 'archiveDay', date: next }}
            onNavigate={onNavigate}
            className="link"
          >
            {formatShortDate(next)} ›
          </RouteLink>
        )}
      </nav>
    </section>
  )
}

function TopScores({ scores }: { scores: ArchiveScores | null }) {
  if (scores === null) {
    return (
      <p className="muted" role="status">
        Loading top scores…
      </p>
    )
  }
  if (scores === 'unavailable') {
    return <p className="muted">The top scores are on the full leaderboard.</p>
  }
  if (scores.players === 0) return <p className="muted">Nobody finished this puzzle.</p>
  return (
    <>
      <p className="stats">
        <strong>{scores.players}</strong> {scores.players === 1 ? 'player' : 'players'} · average{' '}
        <strong>{scores.averageDarts}</strong> darts
      </p>
      <ol className="top-scores">
        {scores.top.slice(0, ARCHIVE_TOP).map((entry) => (
          <li key={entry.rank}>
            <span className="rank">{entry.rank}</span>
            <span className="name">{entry.displayName}</span>
            <span className="darts">
              {entry.totalDarts} {entry.totalDarts === 1 ? 'dart' : 'darts'}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}
