import { useEffect, useState } from 'react'
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
import { useToday } from './useToday'

/** Ranked: today's puzzle, saved and locked once finished. Practice: any past day, never saved. */
export type GameMode = 'ranked' | 'practice'

export type Route =
  | { name: 'menu' }
  | { name: 'game'; mode: GameMode; date: string }
  | { name: 'practice' }
  | { name: 'leaderboard'; date?: string }
  | { name: 'profile' }

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
