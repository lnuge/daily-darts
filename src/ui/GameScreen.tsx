import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateDailyPuzzle } from '../game/puzzle'
import { playThrow, startRound, type ThrowStep } from '../game/round'
import { splitVisits, summarizeRound } from '../game/summary'
import type { ThrowResult } from '../game/throw'
import { feedbackFor } from '../lib/feedback'
import { restoreRankedSteps, saveRankedInputs } from '../lib/progress'
import { isMuted, playSound, setMuted } from '../lib/sound'
import { loadJson, saveJson } from '../lib/storage'
import type { GameMode, Navigate } from './App'
import { Hud } from './Hud'
import { ResultsScreen } from './ResultsScreen'
import { DART_FLIGHT_MS } from '../render/throw'
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

  // Sound, shake and "CHECKOUT!" for each new dart, timed to when it lands.
  // Darts restored when the game reopens are already counted, so they're quiet.
  const [muted, setMutedState] = useState(isMuted)
  const [celebrate, setCelebrate] = useState(0)
  const announced = useRef(restored.steps.length)
  useEffect(() => {
    if (steps.length <= announced.current) return
    announced.current = steps.length
    const feedback = feedbackFor(steps[steps.length - 1])
    for (const sound of feedback.sounds) playSound(sound.name, DART_FLIGHT_MS + sound.delayMs)
    if (!feedback.celebrate) return
    const timer = setTimeout(() => setCelebrate((n) => n + 1), DART_FLIGHT_MS)
    return () => clearTimeout(timer)
  }, [steps])

  const toggleMute = () => {
    setMuted(!muted)
    setMutedState(!muted)
  }

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
      <h1 className="visually-hidden">{ranked ? "Today's puzzle" : `Practice: ${date}`}</h1>
      <Hud
        round={round}
        steps={steps}
        practiceDate={ranked ? undefined : date}
        hintOn={hintOn}
        onToggleHint={toggleHint}
        muted={muted}
        onToggleMute={toggleMute}
        onMenu={() => onNavigate({ name: 'menu' })}
      />
      <ThrowBoard
        puzzle={puzzle}
        enabled={!round.finished}
        visitOpen={round.dartsThisVisit > 0}
        initialDarts={restored.boardDarts}
        onThrow={onThrow}
        celebrate={celebrate}
      />
    </section>
  )
}
