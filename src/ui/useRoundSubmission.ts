import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ThrowInput } from '../game/throw'
import { isSubmitted, submitRankedRound, type SubmitOutcome } from '../lib/submit'
import { supabase } from '../lib/supabase'

export type SubmissionStatus = { kind: 'idle' } | { kind: 'submitting' } | SubmitOutcome

/**
 * Submits a finished ranked round once, and reports how it went. Runs again
 * when the round is reopened if it hasn't been accepted yet (e.g. the player
 * was offline), and on `retry()`.
 */
export function useRoundSubmission(
  enabled: boolean,
  date: string,
  inputs: readonly ThrowInput[],
): { status: SubmissionStatus; retry: () => void } {
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(() =>
    !supabase ? { kind: 'offline' } : isSubmitted(date) ? { kind: 'already' } : null,
  )
  const inFlight = useRef(false)
  const inputsRef = useRef(inputs)
  useLayoutEffect(() => {
    inputsRef.current = inputs
  })

  useEffect(() => {
    if (!enabled || outcome !== null || inFlight.current) return
    inFlight.current = true
    // Not cancelled on unmount: the request is already sent, and React's
    // StrictMode re-runs effects; the in-flight flag stops a second send.
    submitRankedRound(date, inputsRef.current).then((result) => {
      inFlight.current = false
      setOutcome(result)
    })
  }, [enabled, outcome, date])

  const status: SubmissionStatus = outcome ?? (enabled ? { kind: 'submitting' } : { kind: 'idle' })
  return { status, retry: () => setOutcome(null) }
}
