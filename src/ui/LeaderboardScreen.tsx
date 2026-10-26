import { useEffect, useState } from 'react'
import { addDays } from '../game/date'
import { practiceRange } from '../lib/daily'
import { fetchLeaderboard, type Leaderboard, type LeaderboardEntry } from '../lib/leaderboard'
import { supabase } from '../lib/supabase'
import type { Navigate } from './App'
import { RouteLink } from './RouteLink'
import { pathFor } from './routes'

type Props = {
  today: string
  /** Which day to open on; defaults to today. */
  date?: string
  onNavigate: Navigate
  /** Scores to show before fetching: prerendered pages are built with them. */
  initial?: Leaderboard
}

type Load =
  { status: 'loading' } | { status: 'ok'; data: Leaderboard } | { status: 'error'; message: string }

/** Local time the round was verified, e.g. "14:32". */
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function EntryRow({ entry, pinned = false }: { entry: LeaderboardEntry; pinned?: boolean }) {
  const className = [entry.isMe && 'me', pinned && 'pinned'].filter(Boolean).join(' ')
  return (
    <tr className={className || undefined} aria-current={entry.isMe || undefined}>
      <td className="rank">{entry.rank}</td>
      <td className="name">
        {entry.displayName}
        {entry.isMe && <span className="you"> (you)</span>}
      </td>
      <td className="darts">{entry.totalDarts}</td>
      <td className="time muted">{timeOf(entry.finishedAt)}</td>
    </tr>
  )
}

export function LeaderboardScreen({ today, date: initialDate, onNavigate, initial }: Props) {
  // Past leaderboards go back as far as practice does (launch day, or 30 days before it).
  const { min } = practiceRange(today)
  const [date, setDate] = useState(initialDate ?? today)
  // Keyed by date and request, so a slow answer for a day you've left is ignored.
  const [reloads, setReloads] = useState(0)
  const key = `${date}#${reloads}`
  const [load, setLoad] = useState<{ key: string; value: Load } | null>(() =>
    initial ? { key, value: { status: 'ok', data: initial } } : null,
  )

  useEffect(() => {
    if (!supabase) return
    let current = true
    fetchLeaderboard(date).then(
      (data) => current && setLoad({ key, value: { status: 'ok', data } }),
      (error: Error) =>
        current && setLoad({ key, value: { status: 'error', message: error.message } }),
    )
    return () => {
      current = false
    }
  }, [date, key])

  // Keep the address on the day being viewed, so a refresh or a shared link
  // opens the same leaderboard. Replaces the entry: day-flipping isn't history.
  useEffect(() => {
    const path = pathFor({ name: 'leaderboard', date: date === today ? undefined : date })
    if (window.location.pathname !== path) window.history.replaceState(null, '', path)
  }, [date, today])

  const state: Load = load?.key === key ? load.value : { status: 'loading' }
  const go = (day: string) => {
    if (day >= min && day <= today) setDate(day)
  }

  return (
    <section className="screen leaderboard">
      <div className="topbar">
        <button className="link back" onClick={() => onNavigate({ name: 'menu' })}>
          ‹ Menu
        </button>
      </div>
      <header className="title">
        <h1>Leaderboard</h1>
        <p className="muted">{date === today ? "Today's puzzle" : `Puzzle for ${date}`}</p>
      </header>

      <div className="date-nav">
        <button
          className="secondary"
          aria-label="Previous day"
          disabled={date <= min}
          onClick={() => go(addDays(date, -1))}
        >
          ‹
        </button>
        <input
          type="date"
          aria-label="Leaderboard date"
          value={date}
          min={min}
          max={today}
          onChange={(e) => go(e.target.value)}
        />
        <button
          className="secondary"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => go(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      {!supabase ? (
        <p className="muted">
          The leaderboard needs Supabase. Add your keys to .env.local (see docs/supabase-setup.md).
        </p>
      ) : state.status === 'loading' ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : state.status === 'error' ? (
        <p className="submission error" role="alert">
          Couldn't load the leaderboard: {state.message}{' '}
          <button className="link" onClick={() => setReloads((n) => n + 1)}>
            Try again
          </button>
        </p>
      ) : (
        <Board data={state.data} />
      )}

      {supabase && (
        <button className="link" onClick={() => setReloads((n) => n + 1)}>
          Refresh
        </button>
      )}

      <p className="muted page-note">
        Every day's puzzle has its own leaderboard. Fewest darts wins, and ties go to whoever
        finished first. Past puzzles, with their best possible finishes, are in the{' '}
        <RouteLink to={{ name: 'archive' }} onNavigate={onNavigate}>
          archive
        </RouteLink>
        .
      </p>
    </section>
  )
}

function Board({ data }: { data: Leaderboard }) {
  if (data.players === 0) {
    return <p className="muted">No verified rounds for this day yet.</p>
  }
  // The player's own row, shown separately when they're outside the top list.
  const meBelow = data.me && data.me.rank > data.top.length ? data.me : null

  return (
    <>
      <p className="stats">
        <strong>{data.players}</strong> {data.players === 1 ? 'player' : 'players'} · average{' '}
        <strong>{data.averageDarts}</strong> darts
        {data.me && (
          <>
            {' '}
            · you're <strong>#{data.me.rank}</strong>
          </>
        )}
      </p>
      <div className="board-table">
        <table>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <th scope="col">Darts</th>
              <th scope="col">Finished</th>
            </tr>
          </thead>
          <tbody>
            {data.top.map((entry) => (
              <EntryRow key={entry.rank} entry={entry} />
            ))}
            {meBelow && (
              <>
                <tr className="gap" aria-hidden="true">
                  <td colSpan={4}>⋯</td>
                </tr>
                {/* Stays in view at the bottom of the list while scrolling. */}
                <EntryRow entry={meBelow} pinned />
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
