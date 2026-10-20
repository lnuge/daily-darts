import { useEffect, useState } from 'react'
import { fetchPlayerStats, type PlayerStats } from '../lib/stats'

export type StatsLoad =
  | { status: 'loading' }
  | { status: 'ok'; stats: PlayerStats }
  | { status: 'error'; message: string }

/**
 * Loads the player's stats while `enabled`. `refresh` changes trigger a
 * reload (e.g. after a round is verified).
 */
export function usePlayerStats(enabled: boolean, today: string, refresh: unknown = 0): StatsLoad {
  const key = `${today}#${String(refresh)}`
  const [load, setLoad] = useState<{ key: string; value: StatsLoad } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let current = true
    fetchPlayerStats(today).then(
      (stats) => current && setLoad({ key, value: { status: 'ok', stats } }),
      (error: Error) =>
        current && setLoad({ key, value: { status: 'error', message: error.message } }),
    )
    return () => {
      current = false
    }
  }, [enabled, today, key])

  return load?.key === key ? load.value : { status: 'loading' }
}
