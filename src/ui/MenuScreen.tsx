import type { Screen } from './App'
import { BoardCanvas } from './BoardCanvas'

type Props = {
  dateKey: string
  onNavigate: (screen: Screen) => void
}

export function MenuScreen({ dateKey, onNavigate }: Props) {
  return (
    <section className="screen">
      <header className="title">
        <h1>Daily Darts</h1>
        <p className="muted">Puzzle for {dateKey}</p>
      </header>
      <BoardCanvas />
      <div className="actions">
        <button onClick={() => onNavigate('game')}>Play</button>
        <button className="secondary" onClick={() => onNavigate('leaderboard')}>
          Leaderboard
        </button>
      </div>
    </section>
  )
}
