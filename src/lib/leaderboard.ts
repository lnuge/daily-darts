/**
 * Fetches a day's leaderboard with one call to the get_leaderboard RPC
 * (supabase/migrations/20261022090000_leaderboard.sql).
 */

import { supabase } from './supabase'

export type LeaderboardEntry = {
  rank: number
  displayName: string
  totalDarts: number
  /** When the server verified the round (ties go to the earlier one). */
  finishedAt: string
  isMe: boolean
}

export type Leaderboard = {
  date: string
  /** Verified rounds that day. */
  players: number
  averageDarts: number | null
  /** Up to 100, best first. */
  top: LeaderboardEntry[]
  /** The current player's own entry, wherever it ranks, or null if they didn't play. */
  me: LeaderboardEntry | null
}

type RawEntry = {
  rank: number
  display_name: string
  total_darts: number
  finished_at: string
  is_me?: boolean
}

type RawLeaderboard = {
  date: string
  players: number
  average_darts: number | null
  top: RawEntry[]
  me: RawEntry | null
}

const entry = (raw: RawEntry, isMe: boolean): LeaderboardEntry => ({
  rank: raw.rank,
  displayName: raw.display_name,
  totalDarts: raw.total_darts,
  finishedAt: raw.finished_at,
  isMe,
})

/** Throws if Supabase isn't configured or the request fails. */
export async function fetchLeaderboard(date: string): Promise<Leaderboard> {
  if (!supabase) throw new Error('Supabase is not configured.')
  // Sends the player's session if they have one, so `me` is filled in.
  const { data, error } = await supabase.rpc('get_leaderboard', { p_date: date })
  if (error) throw new Error(error.message)
  const raw = data as RawLeaderboard
  return {
    date: raw.date,
    players: raw.players,
    averageDarts: raw.average_darts,
    top: raw.top.map((r) => entry(r, r.is_me ?? false)),
    me: raw.me ? entry(raw.me, true) : null,
  }
}
