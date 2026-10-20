import type { PlayerStats } from '../lib/stats'
import type { StatsLoad } from './usePlayerStats'

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
      {detail && <span className="tile-detail muted">{detail}</span>}
    </div>
  )
}

/** Streaks, average, best round and perfect checkouts as a grid of tiles. */
export function StatsGrid({ stats }: { stats: PlayerStats }) {
  return (
    <div className="stats-grid" aria-label="Your stats">
      <Tile
        label="Current streak"
        value={String(stats.currentStreak)}
        detail={days(stats.currentStreak)}
      />
      <Tile label="Best streak" value={String(stats.bestStreak)} detail={days(stats.bestStreak)} />
      <Tile
        label="Average darts"
        value={stats.averageDarts === null ? '–' : String(stats.averageDarts)}
      />
      <Tile
        label="Best round"
        value={stats.bestRound ? String(stats.bestRound.totalDarts) : '–'}
        detail={stats.bestRound ? `darts, ${stats.bestRound.puzzleDate}` : undefined}
      />
      <Tile
        label="Perfect checkouts"
        value={String(stats.perfectCheckouts)}
        detail="fewest possible darts"
      />
      <Tile label="Rounds played" value={String(stats.roundsPlayed)} />
    </div>
  )
}

const days = (n: number) => (n === 1 ? 'day' : 'days')

/** The grid with loading and error states. */
export function StatsPanel({ load }: { load: StatsLoad }) {
  if (load.status === 'loading') {
    return (
      <p className="muted" role="status">
        Loading your stats…
      </p>
    )
  }
  if (load.status === 'error') {
    return <p className="submission error">Couldn't load your stats: {load.message}</p>
  }
  return <StatsGrid stats={load.stats} />
}
