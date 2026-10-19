import type { Screen } from './App'

type Props = {
  onNavigate: (screen: Screen) => void
}

export function ResultsScreen({ onNavigate }: Props) {
  return (
    <section className="screen">
      <h2>Results</h2>
      <p className="muted">Your score will show here.</p>
      <div className="actions">
        <button onClick={() => onNavigate('leaderboard')}>Leaderboard</button>
        <button className="secondary" onClick={() => onNavigate('menu')}>
          Menu
        </button>
      </div>
    </section>
  )
}
