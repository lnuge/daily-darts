import { useMemo } from 'react'
import { rankedStatus } from '../lib/progress'
import type { Navigate } from './App'
import { BoardCanvas } from './BoardCanvas'

type Props = {
  today: string
  onNavigate: Navigate
}

export function MenuScreen({ today, onNavigate }: Props) {
  const status = useMemo(() => rankedStatus(today), [today])
  const play = () => onNavigate({ name: 'game', mode: 'ranked', date: today })

  return (
    <section className="screen">
      <header className="title">
        <h1>Daily Darts</h1>
        <p className="muted">Puzzle for {today}</p>
      </header>
      <BoardCanvas />
      <div className="actions">
        <button onClick={play}>
          {status.status === 'finished'
            ? "Today's results"
            : status.status === 'in-progress'
              ? `Resume (${status.darts} ${status.darts === 1 ? 'dart' : 'darts'})`
              : 'Play'}
        </button>
        <button className="secondary" onClick={() => onNavigate({ name: 'practice' })}>
          Practice
        </button>
        <button className="secondary" onClick={() => onNavigate({ name: 'leaderboard' })}>
          Leaderboard
        </button>
      </div>
    </section>
  )
}
