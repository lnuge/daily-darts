import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import { playThrow, startRound, type ThrowStep } from '../game/round'
import { splitVisits, summarizeRound } from '../game/summary'
import type { ThrowResult } from '../game/throw'
import { restoreRankedSteps, saveRankedInputs } from '../lib/progress'
import { loadJson, saveJson } from '../lib/storage'
import type { GameMode, Navigate } from './App'
import { Hud } from './Hud'
import { ResultsScreen } from './ResultsScreen'
import { ThrowBoard } from './ThrowBoard'
import { useRoundSubmission } from './useRoundSubmission'

type Props = {
  mode: GameMode
  date: string
  onNavigate: Navigate
}

/** Long enough to see the final checkout land before the results appear. */
const RESULTS_DELAY_MS = 1500

/** What the game opens with: a saved ranked round, or a fresh one. */
function restore(mode: GameMode, date: string) {
  const steps = mode === 'ranked' ? restoreRankedSteps(date) : []
  const finished = steps[steps.length - 1]?.state.finished ?? false
  // The last visit's darts go back on the board, matching the HUD, so it
  // looks exactly as it was left. They're cleared when the next visit starts.
  const lastVisit = finished ? 0 : (splitVisits(steps).at(-1)?.hits.length ?? 0)
  return {
    steps,
    finished,
    boardDarts: steps.slice(steps.length - lastVisit).map((s) => s.throw),
  }
}

export function GameScreen({ mode, date, onNavigate }: Props) {
  const ranked = mode === 'ranked'
  const puzzle = useMemo(() => generateDailyPuzzle(date), [date])
  const [restored] = useState(() => restore(mode, date))
  // The round is the list of steps; every state is derived from it by the
  // same pure functions the server will replay.
  const [steps, setSteps] = useState<ThrowStep[]>(restored.steps)
  const [hintOn, setHintOn] = useState(() => loadJson<boolean>('hint') ?? true)
  // A finished ranked round is locked: reopening it goes straight to the results.
  const [showResults, setShowResults] = useState(restored.finished)

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

  // Save after every throw, so closing the tab loses nothing.
  useEffect(() => {
    if (!ranked || steps.length === 0) return
    saveRankedInputs(
      date,
      steps.map((s) => s.throw.input),
    )
  }, [ranked, date, steps])

  // A finished ranked round goes to the server to be replayed and verified.
  // (This also starts a guest session if needed: only now, so idle visitors
  // don't create accounts.)
  const submission = useRoundSubmission(
    ranked && round.finished,
    date,
    steps.map((s) => s.throw.input),
  )

  const toggleHint = () =>
    setHintOn((on) => {
      saveJson('hint', !on)
      return !on
    })

  useEffect(() => {
    if (!round.finished || showResults) return
    const timer = setTimeout(() => setShowResults(true), RESULTS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [round.finished, showResults])

  if (showResults) {
    return (
      <ResultsScreen
        mode={mode}
        puzzle={puzzle}
        summary={summarizeRound(steps, puzzle.targets)}
        submission={submission}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <section className="screen game">
      {!ranked && <p className="badge practice">Practice · {date} · Unranked</p>}
      <Hud round={round} steps={steps} hintOn={hintOn} onToggleHint={toggleHint} />
      <ThrowBoard
        puzzle={puzzle}
        enabled={!round.finished}
        visitOpen={round.dartsThisVisit > 0}
        initialDarts={restored.boardDarts}
        onThrow={onThrow}
      />
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
          Menu
        </button>
      </div>
    </section>
  )
}
