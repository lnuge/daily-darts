import { useState } from 'react'
import { todayKey } from '../lib/daily'
import { rankedStatus } from '../lib/progress'
import { GameScreen } from './GameScreen'
import { LeaderboardScreen } from './LeaderboardScreen'
import { MenuScreen } from './MenuScreen'
import { PracticeScreen } from './PracticeScreen'
import { useToday } from './useToday'

/** Ranked: today's puzzle, saved and locked once finished. Practice: any past day, never saved. */
export type GameMode = 'ranked' | 'practice'

export type Route =
  | { name: 'menu' }
  | { name: 'game'; mode: GameMode; date: string }
  | { name: 'practice' }
  | { name: 'leaderboard' }

export type Navigate = (route: Route) => void

/** Open straight to today's results if the ranked round is already finished. */
function initialRoute(): Route {
  const today = todayKey()
  return rankedStatus(today).status === 'finished'
    ? { name: 'game', mode: 'ranked', date: today }
    : { name: 'menu' }
}

export function App() {
  const [route, setRoute] = useState<Route>(initialRoute)
  // Rolls over at local midnight. A game keeps the date it was started with,
  // so a round under way at midnight stays on its own puzzle.
  const today = useToday()

  return (
    <main className="app">
      {route.name === 'menu' && <MenuScreen today={today} onNavigate={setRoute} />}
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
      {route.name === 'leaderboard' && <LeaderboardScreen dateKey={today} onNavigate={setRoute} />}
    </main>
  )
}
