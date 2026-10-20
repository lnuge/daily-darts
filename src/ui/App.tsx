import { useState } from 'react'
import { todayKey } from '../lib/daily'
import { GameScreen } from './GameScreen'
import { LeaderboardScreen } from './LeaderboardScreen'
import { MenuScreen } from './MenuScreen'

export type Screen = 'menu' | 'game' | 'leaderboard'

export function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  // Fixed for the session so a round started before local midnight stays on its puzzle.
  const [dateKey] = useState(todayKey)

  return (
    <main className="app">
      {screen === 'menu' && <MenuScreen dateKey={dateKey} onNavigate={setScreen} />}
      {screen === 'game' && <GameScreen dateKey={dateKey} onNavigate={setScreen} />}
      {screen === 'leaderboard' && <LeaderboardScreen dateKey={dateKey} onNavigate={setScreen} />}
    </main>
  )
}
