import { useEffect, useState } from 'react'
import { addDays } from '../game/date'
import { practiceRange } from '../lib/daily'
import { fetchLeaderboard, type Leaderboard, type LeaderboardEntry } from '../lib/leaderboard'
import { supabase } from '../lib/supabase'
import type { Navigate } from './App'

type Props = {
  today: string
  /** Which day to open on; defaults to today. */
  date?: string
  onNavigate: Navigate
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

export function LeaderboardScreen({ today, date: initialDate, onNavigate }: Props) {
  // Past leaderboards go back as far as practice does (launch day, or 30 days before it).
  const { min } = practiceRange(today)
  const [date, setDate] = useState(initialDate ?? today)
  // Keyed by date and request, so a slow answer for a day you've left is ignored.
  const [load, setLoad] = useState<{ key: string; value: Load } | null>(null)
  const [reloads, setReloads] = useState(0)
  const key = `${date}#${reloads}`

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

  const state: Load = load?.key === key ? load.value : { status: 'loading' }
  const go = (day: string) => {
    if (day >= min && day <= today) setDate(day)
  }

  return (
    <section className="screen leaderboard">
      <header className="title">
        <h2>Leaderboard</h2>
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

      <div className="actions">
        {supabase && (
          <button className="secondary" onClick={() => setReloads((n) => n + 1)}>
            Refresh
          </button>
        )}
        <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
          Menu
        </button>
      </div>
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
