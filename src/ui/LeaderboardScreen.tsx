import { supabase } from '../lib/supabase'
import type { Screen } from './App'

type Props = {
  dateKey: string
  onNavigate: (screen: Screen) => void
}

export function LeaderboardScreen({ dateKey, onNavigate }: Props) {
  return (
    <section className="screen">
      <h2>Leaderboard</h2>
      <p className="muted">
        {supabase
          ? `Scores for ${dateKey} will show here.`
          : 'Supabase is not configured. Copy .env.example to .env.local to enable.'}
      </p>
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate('menu')}>
          Menu
        </button>
      </div>
    </section>
  )
}
