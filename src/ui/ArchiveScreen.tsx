import { useState } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import { archiveDates } from '../lib/archive'
import { formatLongDate, formatMonth } from '../lib/daily'
import type { Navigate } from './App'
import { RouteLink } from './RouteLink'

type Props = {
  onNavigate: Navigate
  /** The moment to list the archive at; prerendered pages pass the build time. */
  nowMs?: number
}

/** "Sat 14". */
function dayLabel(date: string): string {
  const [weekday, day] = formatLongDate(date).split(' ')
  return `${weekday.slice(0, 3)} ${day}`
}

/** Every past puzzle, newest first, grouped by month. */
export function ArchiveScreen({ onNavigate, nowMs }: Props) {
  const [dates] = useState(() => archiveDates(nowMs ?? Date.now()))
  const months: { label: string; dates: string[] }[] = []
  for (const date of dates) {
    const label = formatMonth(date)
    if (months.at(-1)?.label !== label) months.push({ label, dates: [] })
    months[months.length - 1].dates.push(date)
  }

  return (
    <section className="screen article archive">
      <div className="topbar">
        <button className="link back" onClick={() => onNavigate({ name: 'menu' })}>
          ‹ Menu
        </button>
      </div>
      <header className="title">
        <h1>Puzzle archive</h1>
        <p className="muted">Every past Daily Darts puzzle</p>
      </header>
      <p className="page-note">
        Each day's three checkouts, the fewest darts that could finish them, and the top scores.
        Pick a day to see it, or play it again for practice.
      </p>

      {months.length === 0 ? (
        <p className="muted">
          Puzzles join the archive once they've closed everywhere in the world. Check back tomorrow.
        </p>
      ) : (
        months.map((month) => (
          <section key={month.label} className="archive-month" aria-label={month.label}>
            <h2>{month.label}</h2>
            <ol className="archive-list">
              {month.dates.map((date) => {
                const { puzzleNumber, targets } = generateDailyPuzzle(date)
                return (
                  <li key={date}>
                    <RouteLink to={{ name: 'archiveDay', date }} onNavigate={onNavigate}>
                      <span className="archive-date">{dayLabel(date)}</span>
                      <span className="archive-no">
                        {puzzleNumber >= 0 ? `#${puzzleNumber}` : ''}
                      </span>
                      <span className="archive-targets">{targets.join(' · ')}</span>
                    </RouteLink>
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}
    </section>
  )
}
