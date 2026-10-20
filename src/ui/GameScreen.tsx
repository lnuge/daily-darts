import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import { playThrow, startRound, type ThrowStep } from '../game/round'
import { summarizeRound } from '../game/summary'
import type { ThrowResult } from '../game/throw'
import { loadJson, saveJson } from '../lib/storage'
import type { Screen } from './App'
import { Hud } from './Hud'
import { ResultsScreen } from './ResultsScreen'
import { ThrowBoard } from './ThrowBoard'

type Props = {
  dateKey: string
  onNavigate: (screen: Screen) => void
}

/** Long enough to see the final checkout land before the results appear. */
const RESULTS_DELAY_MS = 1500

export function GameScreen({ dateKey, onNavigate }: Props) {
  const puzzle = useMemo(() => generateDailyPuzzle(dateKey), [dateKey])
  // The round is the list of steps; every state is derived from it by the
  // same pure functions the server will replay.
  const [steps, setSteps] = useState<ThrowStep[]>([])
  const [hintOn, setHintOn] = useState(() => loadJson<boolean>('hint') ?? true)
  const [showResults, setShowResults] = useState(false)

  const round = steps.length ? steps[steps.length - 1].state : startRound(puzzle)

  const onThrow = useCallback(
    (result: ThrowResult) =>
      setSteps((prev) => {
        const state = prev.length ? prev[prev.length - 1].state : startRound(puzzle)
        if (state.finished) return prev
        return [...prev, playThrow(state, puzzle, result.input)]
      }),
    [puzzle],
  )

  const toggleHint = () =>
    setHintOn((on) => {
      saveJson('hint', !on)
      return !on
    })

  useEffect(() => {
    if (!round.finished) return
    const timer = setTimeout(() => setShowResults(true), RESULTS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [round.finished])

  if (showResults) {
    return (
      <ResultsScreen
        puzzle={puzzle}
        summary={summarizeRound(steps, puzzle.targets)}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <section className="screen game">
      <Hud round={round} steps={steps} hintOn={hintOn} onToggleHint={toggleHint} />
      <ThrowBoard
        puzzle={puzzle}
        enabled={!round.finished}
        visitOpen={round.dartsThisVisit > 0}
        onThrow={onThrow}
      />
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate('menu')}>
          Menu
        </button>
      </div>
    </section>
  )
}
