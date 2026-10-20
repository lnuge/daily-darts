import { useCallback, useEffect, useState } from 'react'
import { todayKey } from '../lib/daily'
import { rankedStatus } from '../lib/progress'
import { installAudioUnlock } from '../lib/sound'
import { loadJson, saveJson } from '../lib/storage'
import { GameScreen } from './GameScreen'
import { HowToPlay } from './HowToPlay'
import { LeaderboardScreen } from './LeaderboardScreen'
import { MenuScreen } from './MenuScreen'
import { PracticeScreen } from './PracticeScreen'
import { ProfileScreen } from './ProfileScreen'
import { pathFor, routeFromPath, type Route } from './routes'
import { useToday } from './useToday'

// Ranked: today's puzzle, saved and locked once finished. Practice: any past day, never saved.
export type { GameMode, Route } from './routes'

export type Navigate = (route: Route) => void

/**
 * The screen for the address the page was opened at. Opening the home page
 * with today's round already finished goes straight to its results.
 */
function initialRoute(): Route {
  const today = todayKey()
  const route = routeFromPath(window.location.pathname, today)
  const opening =
    route.name === 'menu' && rankedStatus(today).status === 'finished'
      ? ({ name: 'game', mode: 'ranked', date: today } as const)
      : route
  // Tidy the address (unknown paths become /, etc.). Keep the query and hash:
  // a Google sign-in comes back with a one-time code there for Supabase to read.
  const { pathname, search, hash } = window.location
  if (pathname !== pathFor(opening)) {
    window.history.replaceState(null, '', pathFor(opening) + search + hash)
  }
  return opening
}

export function App() {
  const [route, setRouteState] = useState<Route>(initialRoute)

  // Moving between screens adds a history entry, so Back works.
  const setRoute: Navigate = useCallback((next) => {
    const path = pathFor(next)
    if (path !== window.location.pathname) window.history.pushState(null, '', path)
    setRouteState(next)
  }, [])

  useEffect(() => {
    const onPopState = () => setRouteState(routeFromPath(window.location.pathname, todayKey()))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  // Rolls over at local midnight. A game keeps the date it was started with,
  // so a round under way at midnight stays on its own puzzle.
  const today = useToday()
  // Shown automatically on the first visit, and from the menu after that.
  const [howTo, setHowTo] = useState(() => loadJson<boolean>('howto-seen') !== true)
  const closeHowTo = () => {
    saveJson('howto-seen', true)
    setHowTo(false)
  }

  // Browsers only allow audio after a user gesture: unlock it on the first one.
  useEffect(() => installAudioUnlock(), [])

  return (
    <main className="app">
      {route.name === 'menu' && (
        <MenuScreen today={today} onNavigate={setRoute} onHowToPlay={() => setHowTo(true)} />
      )}
      {route.name === 'game' && (
        <GameScreen
          // A different game is a fresh component, not a reused one.
          key={`${route.mode}:${route.date}`}
          mode={route.mode}
          date={route.date}
          onNavigate={setRoute}
        />
      )}
      {route.name === 'practice' && <PracticeScreen today={today} onNavigate={setRoute} />}
      {route.name === 'profile' && <ProfileScreen today={today} onNavigate={setRoute} />}
      {route.name === 'leaderboard' && (
        <LeaderboardScreen today={today} date={route.date} onNavigate={setRoute} />
      )}
      <HowToPlay open={howTo} onClose={closeHowTo} />
    </main>
  )
}
