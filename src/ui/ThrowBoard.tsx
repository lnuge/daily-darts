import { useEffect, useRef, useState } from 'react'
import { hitLabel } from '../game/board'
import type { DailyPuzzle } from '../game/puzzle'
import {
  MAX_THROW_MS,
  aimPoint,
  resolveThrow,
  sweepPosition,
  type ThrowResult,
} from '../game/throw'
import { fitBoard } from '../render/board'
import { setupCanvas, type CanvasSurface } from '../render/canvas'
import { DART_FLIGHT_MS, drawThrowScene, type ThrowScene } from '../render/throw'
import { BoardCanvas } from './BoardCanvas'

type Phase = 'aimX' | 'aimY' | 'landed'

type Status = { phase: Phase; last: ThrowResult | null }

/** Darts left on the board; the oldest is removed when a fourth lands. */
const DARTS_SHOWN = 3

/**
 * The throw loop. Collects the two taps of each throw as whole milliseconds
 * since the throw started, hands them to `resolveThrow` (pure, in src/game)
 * and draws the result. Nothing here decides where a dart lands.
 *
 * Two stacked canvases: the static board underneath, and an overlay redrawn
 * every frame with the aim lines and darts.
 */
export function ThrowBoard({ puzzle }: { puzzle: DailyPuzzle }) {
  const stackRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>({ phase: 'aimX', last: null })

  useEffect(() => {
    const stack = stackRef.current
    const canvas = overlayRef.current
    if (!stack || !canvas) return

    // Throw state. Plain variables, not React state: they change every tap
    // and are read every frame. React state only mirrors them for the text.
    let phase: Phase = 'aimX'
    let start = performance.now()
    let lockX = 0
    const darts: { result: ThrowResult; resolvedAt: number }[] = []

    const startThrow = (now: number) => {
      phase = 'aimX'
      start = now
      setStatus((s) => ({ ...s, phase }))
    }

    const tap = () => {
      const now = performance.now()
      // Whole milliseconds: the exact numbers the server will replay.
      const elapsed = Math.round(now - start)
      if (phase === 'aimX') {
        if (elapsed > MAX_THROW_MS) return startThrow(now) // left idle too long
        lockX = elapsed
        phase = 'aimY'
        setStatus((s) => ({ ...s, phase }))
      } else if (phase === 'aimY') {
        if (elapsed > MAX_THROW_MS) return startThrow(now)
        const result = resolveThrow(puzzle, { lockX, lockY: elapsed })
        darts.push({ result, resolvedAt: now })
        if (darts.length > DARTS_SHOWN) darts.shift()
        phase = 'landed'
        setStatus({ phase, last: result })
      } else if (now - darts[darts.length - 1].resolvedAt >= DART_FLIGHT_MS) {
        startThrow(now) // ignore taps while the dart is still in the air
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      tap()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Let Space press a focused button (Back, Finish) as usual.
      if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) {
        return
      }
      e.preventDefault() // no page scroll
      if (!e.repeat) tap()
    }
    stack.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    let surface: CanvasSurface | null = null
    let frame = 0
    const draw = () => {
      // Resize the backing store if the CSS size or pixel ratio changed.
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      if (
        !surface ||
        Math.round(rect.width * dpr) !== canvas.width ||
        Math.round(rect.height * dpr) !== canvas.height
      ) {
        surface = setupCanvas(canvas)
      }
      const { ctx, width, height } = surface
      ctx.clearRect(0, 0, width, height)

      const now = performance.now()
      const elapsed = now - start
      const last = darts[darts.length - 1]
      const scene: ThrowScene = {
        aim:
          phase === 'aimX'
            ? {
                x: sweepPosition(elapsed, puzzle.sweepSpeed),
                y: null,
                xLocked: false,
                yLocked: false,
                sinceLandedMs: null,
              }
            : phase === 'aimY'
              ? {
                  x: aimPoint({ lockX, lockY: lockX }, puzzle.sweepSpeed).x,
                  y: sweepPosition(elapsed - lockX, puzzle.sweepSpeed),
                  xLocked: true,
                  yLocked: false,
                  sinceLandedMs: null,
                }
              : {
                  ...last.result.aim,
                  xLocked: true,
                  yLocked: true,
                  sinceLandedMs: now - last.resolvedAt,
                },
        darts: darts.map((d) => ({
          ...d.result.landing,
          hit: d.result.hit,
          ageMs: now - d.resolvedAt,
          showScore: phase === 'landed' && d === last,
        })),
      }
      drawThrowScene(ctx, fitBoard(width, height), scene)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      stack.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [puzzle])

  const { phase, last } = status
  return (
    <>
      <div
        ref={stackRef}
        className="board-stack"
        // The last throw's input, for debugging and end-to-end tests.
        data-last-throw={last ? JSON.stringify(last.input) : undefined}
      >
        <BoardCanvas className="layer" />
        <canvas ref={overlayRef} className="layer" aria-hidden="true" />
      </div>
      <div className="throw-status" aria-live="polite">
        {phase === 'landed' && last ? (
          <>
            <p className="throw-result">
              {last.hit.multiplier === 0
                ? 'Miss'
                : `${hitLabel(last.hit)} · ${last.hit.points} points`}
            </p>
            <p className="muted">Tap or press Space to throw again</p>
          </>
        ) : (
          <p className="muted">
            Tap or press Space to lock {phase === 'aimX' ? 'left–right' : 'up–down'}
          </p>
        )}
      </div>
    </>
  )
}
