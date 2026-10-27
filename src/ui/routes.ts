/**
 * Screens ↔ URLs, so every screen has an address that survives a refresh and
 * works with the back button. Pure functions; App wires them to the History API.
 *
 *   /                          menu
 *   /play                      today's ranked game (or its results)
 *   /practice                  pick a past day
 *   /practice/2026-10-15       a practice game for that day
 *   /leaderboard               today's leaderboard
 *   /leaderboard/2026-10-15    that day's leaderboard
 *   /profile                   stats and account
 *   /privacy, /terms           privacy policy and terms of service
 *   /accessibility             accessibility statement
 *   /how-to-play               the rules
 *   /archive                   every past puzzle
 *   /archive/2026-11-14        one past puzzle: targets, best finishes, top scores
 *
 * On Cloudflare, any path that isn't a file serves index.html (see
 * wrangler.jsonc), and routeFromPath decides what to show.
 */

import { parseDateKey } from '../game/date'
import { practiceRange } from '../lib/daily'

export type GameMode = 'ranked' | 'practice'

export type Route =
  | { name: 'menu' }
  | { name: 'game'; mode: GameMode; date: string }
  | { name: 'practice' }
  | { name: 'leaderboard'; date?: string }
  | { name: 'profile' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'accessibility' }
  | { name: 'howToPlay' }
  | { name: 'archive' }
  | { name: 'archiveDay'; date: string }

export function pathFor(route: Route): string {
  switch (route.name) {
    case 'menu':
      return '/'
    case 'game':
      return route.mode === 'ranked' ? '/play' : `/practice/${route.date}`
    case 'practice':
      return '/practice'
    case 'leaderboard':
      return route.date ? `/leaderboard/${route.date}` : '/leaderboard'
    case 'profile':
      return '/profile'
    case 'privacy':
      return '/privacy'
    case 'terms':
      return '/terms'
    case 'accessibility':
      return '/accessibility'
    case 'howToPlay':
      return '/how-to-play'
    case 'archive':
      return '/archive'
    case 'archiveDay':
      return `/archive/${route.date}`
  }
}

function isDateKey(value: string): boolean {
  try {
    parseDateKey(value)
    return true
  } catch {
    return false
  }
}

/**
 * The screen for a path. Unknown paths, and dates that aren't allowed (a
 * practice day outside the practice range, a leaderboard in the future), fall
 * back to the nearest sensible screen.
 */
export function routeFromPath(path: string, today: string): Route {
  const parts = path.split('/').filter(Boolean)
  const [first, second, ...rest] = parts
  if (rest.length) return { name: 'menu' }

  switch (first) {
    case undefined:
      return { name: 'menu' }
    case 'play':
      return second === undefined ? { name: 'game', mode: 'ranked', date: today } : { name: 'menu' }
    case 'practice': {
      if (second === undefined) return { name: 'practice' }
      const { min, max } = practiceRange(today)
      return isDateKey(second) && second >= min && second <= max
        ? { name: 'game', mode: 'practice', date: second }
        : { name: 'practice' }
    }
    case 'leaderboard':
      if (second === undefined) return { name: 'leaderboard' }
      return isDateKey(second) && second <= today
        ? { name: 'leaderboard', date: second }
        : { name: 'leaderboard' }
    case 'profile':
      return second === undefined ? { name: 'profile' } : { name: 'menu' }
    case 'privacy':
    case 'terms':
    case 'accessibility':
      return second === undefined ? { name: first } : { name: 'menu' }
    case 'how-to-play':
      return second === undefined ? { name: 'howToPlay' } : { name: 'menu' }
    case 'archive': {
      // Any past practice day; the screen itself says if a day isn't archived yet.
      if (second === undefined) return { name: 'archive' }
      const { min, max } = practiceRange(today)
      return isDateKey(second) && second >= min && second <= max
        ? { name: 'archiveDay', date: second }
        : { name: 'archive' }
    }
    default:
      return { name: 'menu' }
  }
}
