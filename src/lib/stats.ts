/**
 * The current player's stats, from the get_player_stats RPC
 * (supabase/migrations/20261023090000_player_stats.sql). Computed on the
 * server from verified rounds only, so they can't be faked from here.
 */

import { supabase } from './supabase'

export type PlayerStats = {
  roundsPlayed: number
  currentStreak: number
  bestStreak: number
  averageDarts: number | null
  bestRound: { totalDarts: number; puzzleDate: string } | null
  /** Targets finished in the fewest possible darts. */
  perfectCheckouts: number
  lastPlayed: string | null
}

type RawStats = {
  rounds_played: number
  current_streak: number
  best_streak: number
  average_darts: number | null
  best_round: { total_darts: number; puzzle_date: string } | null
  perfect_checkouts: number
  last_played: string | null
}

/**
 * `today` is the player's local date; the server only uses it to decide
 * whether the latest streak is still alive, and won't accept a date that
 * isn't today somewhere on Earth. Throws if Supabase isn't configured or the
 * request fails.
 */
export async function fetchPlayerStats(today: string): Promise<PlayerStats> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('get_player_stats', { p_today: today })
  if (error) throw new Error(error.message)
  const raw = data as RawStats
  return {
    roundsPlayed: raw.rounds_played,
    currentStreak: raw.current_streak,
    bestStreak: raw.best_streak,
    averageDarts: raw.average_darts,
    bestRound: raw.best_round
      ? { totalDarts: raw.best_round.total_darts, puzzleDate: raw.best_round.puzzle_date }
      : null,
    perfectCheckouts: raw.perfect_checkouts,
    lastPlayed: raw.last_played,
  }
}
