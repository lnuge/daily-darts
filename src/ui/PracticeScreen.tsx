import { useState } from 'react'
import { daysBetween, addDays } from '../game/date'
import { practiceRange } from '../lib/daily'
import type { Navigate } from './App'

type Props = {
  today: string
  onNavigate: Navigate
}

/** Pick a past day to replay. Practice rounds are unranked and never saved. */
export function PracticeScreen({ today, onNavigate }: Props) {
  const { min, max } = practiceRange(today)
  const [date, setDate] = useState(max)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= min && date <= max

  const play = (day: string) => onNavigate({ name: 'game', mode: 'practice', date: day })
  const randomDay = () => {
    // UI convenience only; nothing here affects scoring.
    const span = daysBetween(min, max)
    setDate(addDays(min, Math.floor(Math.random() * (span + 1))))
  }

  return (
    <section className="screen">
      <header className="title">
        <h2>Practice</h2>
        <p className="badge practice">Unranked</p>
      </header>
      <p className="muted">
        Replay any past puzzle. Practice rounds don't count toward your stats or the leaderboard,
        and aren't saved.
      </p>
      <label className="date-field">
        <span>Puzzle date</span>
        <input
          type="date"
          value={date}
          min={min}
          max={max}
          required
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {!valid && (
        <p className="muted" role="alert">
          Pick a date from {min} to {max}.
        </p>
      )}
      <div className="actions">
        <button disabled={!valid} onClick={() => play(date)}>
          Play {valid ? date : ''}
        </button>
        <button className="secondary" onClick={randomDay}>
          Random day
        </button>
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
          Menu
        </button>
      </div>
    </section>
  )
}
