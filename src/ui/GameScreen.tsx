import type { Screen } from './App'
import { BoardCanvas } from './BoardCanvas'

type Props = {
  dateKey: string
  onNavigate: (screen: Screen) => void
}

export function GameScreen({ dateKey, onNavigate }: Props) {
  return (
    <section className="screen">
      <p className="muted">Puzzle for {dateKey}</p>
      <BoardCanvas />
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate('menu')}>
          Back
        </button>
        <button onClick={() => onNavigate('results')}>Finish</button>
      </div>
    </section>
  )
}
