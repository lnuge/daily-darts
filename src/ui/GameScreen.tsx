import { useMemo } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import type { Screen } from './App'
import { ThrowBoard } from './ThrowBoard'

type Props = {
  dateKey: string
  onNavigate: (screen: Screen) => void
}

export function GameScreen({ dateKey, onNavigate }: Props) {
  const puzzle = useMemo(() => generateDailyPuzzle(dateKey), [dateKey])

  return (
    <section className="screen">
      <p className="muted">Puzzle for {dateKey}</p>
      <ThrowBoard puzzle={puzzle} />
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate('menu')}>
          Back
        </button>
        <button onClick={() => onNavigate('results')}>Finish</button>
      </div>
    </section>
  )
}
