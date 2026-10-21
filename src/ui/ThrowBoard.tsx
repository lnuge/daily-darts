import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DailyPuzzle } from '../game/puzzle'
import {
  MAX_THROW_MS,
  aimPoint,
  resolveThrow,
  sweepPosition,
  type ThrowInput,
  type ThrowResult,
} from '../game/throw'
import { fitBoard } from '../render/board'
import { canvasDpr, setupCanvas, type CanvasSurface } from '../render/canvas'
import { haptic, playSound } from '../lib/sound'
import { DART_FLIGHT_MS, SCENE_SETTLE_MS, drawThrowScene, type ThrowScene } from '../render/throw'
import { BoardCanvas } from './BoardCanvas'
import { FrameLog, shownAt } from './frameLog'

type Phase = 'aimX' | 'aimY' | 'landed'

type Props = {
  puzzle: DailyPuzzle
  /** False once the round is over: taps are ignored and nothing sweeps. */
  enabled: boolean
  /**
   * True while a visit is in progress. When the next throw starts and this
   * is false, the board is cleared, like pulling the darts out.
   */
  visitOpen: boolean
  /** Darts already on the board when it opens (a resumed visit). Read once. */
  initialDarts?: readonly ThrowResult[]
  /** Called once per throw with its resolved result. */
  onThrow: (result: ThrowResult) => void
  /** Bump to shake the board and flash "CHECKOUT!" (0 = never). */
  celebrate?: number
}

/** Never more than one visit's darts on the board. */
const DARTS_SHOWN = 3

/**
 * Taps closer together than this are treated as one: an accidental double tap
 * (or a bounce) shouldn't lock both lines or throw a dart by surprise. No
 * deliberate tap needs to be faster: the second line has barely left the edge.
 */
const MIN_TAP_GAP_MS = 120

/** Taps on these are theirs (buttons, links...), not throws. */
const NOT_A_THROW = 'button, a, input, select, textarea, label, dialog'

/** The overlay is redrawn every frame; 2x is sharp enough and much cheaper than 3x. */
const OVERLAY_MAX_DPR = 2

const SHAKE: Keyframe[] = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-6px, 3px)' },
  { transform: 'translate(5px, -4px)' },
  { transform: 'translate(-4px, -2px)' },
  { transform: 'translate(3px, 3px)' },
  { transform: 'translate(0, 0)' },
]

/**
 * The throw loop. Collects the two taps of each throw as whole milliseconds
 * since the throw started, hands them to `resolveThrow` (pure, in src/game)
 * and draws the result. Nothing here decides where a dart lands or what the
 * rules make of it: that's the caller's job, via `onThrow`.
 *
 * A tap locks the line where it was on screen at the moment of the tap (see
 * frameLog.ts), not where it has moved on to by the time the tap is handled.
 * Taps count anywhere on the page except on buttons and links, so a thumb
 * needn't cover the board.
 *
 * Two stacked canvases: the static board underneath, and an overlay redrawn
 * every frame with the aim lines and darts.
 */
export function ThrowBoard({
  puzzle,
  enabled,
  visitOpen,
  initialDarts,
  onThrow,
  celebrate = 0,
}: Props) {
  const stackRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('aimX')
  const [lastInput, setLastInput] = useState<ThrowInput | null>(null)
  const [startingDarts] = useState(() => initialDarts ?? [])

  // Latest props for the long-lived loop below, without restarting it.
  const propsRef = useRef({ enabled, visitOpen, onThrow })
  useLayoutEffect(() => {
    propsRef.current = { enabled, visitOpen, onThrow }
  })

  useEffect(() => {
    const stack = stackRef.current
    const canvas = overlayRef.current
    if (!stack || !canvas) return

    // Throw state. Plain variables, not React state: they change every tap
    // and are read every frame. React state only mirrors the phase for text.
    let phase: Phase = 'aimX'
    let start = performance.now()
    let lockX = 0
    // Restored darts are long landed: no fly-in, no score popup.
    const darts: { result: ThrowResult; resolvedAt: number }[] = startingDarts.map((result) => ({
      result,
      resolvedAt: -Infinity,
    }))

    // When the scene has settled and been drawn once, frames are skipped until
    // something changes, so an idle board costs (almost) nothing.
    let settledFrameDrawn = false
    let lastTapAt = -Infinity
    // The aim frames drawn in the current phase, to tell what was on screen at a tap.
    const frameLog = new FrameLog()

    const setLoopPhase = (next: Phase) => {
      phase = next
      settledFrameDrawn = false
      frameLog.clear()
      setPhase(next)
    }

    const startThrow = (now: number) => {
      if (!propsRef.current.visitOpen) darts.length = 0
      start = now
      setLoopPhase('aimX')
    }

    /** `eventTime`: the input event's timeStamp, on performance.now()'s clock. */
    const tap = (eventTime: number) => {
      if (!propsRef.current.enabled) return
      const now = performance.now()
      // When the finger touched (or the key went down). Very old browsers
      // stamped events with the wall clock instead; fall back to now for those.
      const at = Math.abs(now - eventTime) < 1000 ? Math.min(eventTime, now) : now
      if (at - lastTapAt < MIN_TAP_GAP_MS) return // a double tap, not two taps
      // The throw time on screen when the player tapped, in whole milliseconds:
      // the exact numbers the server will replay.
      const elapsed = Math.round(shownAt(frameLog.all, at) ?? at - start)
      const lockFeedback = () => {
        playSound('lock')
        haptic(8)
      }
      if (phase === 'aimX') {
        lastTapAt = at
        if (elapsed > MAX_THROW_MS) return startThrow(now) // left idle too long
        lockX = elapsed
        lockFeedback()
        setLoopPhase('aimY')
      } else if (phase === 'aimY') {
        lastTapAt = at
        if (elapsed > MAX_THROW_MS) return startThrow(now)
        lockFeedback()
        const result = resolveThrow(puzzle, { lockX, lockY: Math.max(lockX, elapsed) })
        darts.push({ result, resolvedAt: now })
        if (darts.length > DARTS_SHOWN) darts.shift()
        setLoopPhase('landed')
        setLastInput(result.input)
        propsRef.current.onThrow(result)
      } else if (now - darts[darts.length - 1].resolvedAt >= DART_FLIGHT_MS) {
        lastTapAt = at
        startThrow(now) // ignore taps while the dart is still in the air
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      // One finger at a time: a second finger touching down isn't another tap.
      if (e.button !== 0 || !e.isPrimary) return
      if (e.target instanceof Element && e.target.closest(NOT_A_THROW)) return
      e.preventDefault()
      tap(e.timeStamp)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Let Space press a focused button or toggle as usual.
      if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) {
        return
      }
      e.preventDefault() // no page scroll
      if (!e.repeat) tap(e.timeStamp)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    let surface: CanvasSurface | null = null
    let frame = 0
    const draw = () => {
      // Resize the backing store if the CSS size or pixel ratio changed.
      const rect = canvas.getBoundingClientRect()
      const dpr = canvasDpr(OVERLAY_MAX_DPR)
      if (
        !surface ||
        Math.round(rect.width * dpr) !== canvas.width ||
        Math.round(rect.height * dpr) !== canvas.height
      ) {
        surface = setupCanvas(canvas, OVERLAY_MAX_DPR)
        settledFrameDrawn = false
      }

      const now = performance.now()
      const elapsed = now - start
      const last = darts[darts.length - 1]
      const settled =
        phase === 'landed' && last !== undefined && now - last.resolvedAt > SCENE_SETTLE_MS
      if (settled && settledFrameDrawn) {
        frame = requestAnimationFrame(draw)
        return
      }
      settledFrameDrawn = settled

      const { ctx, width, height } = surface
      ctx.clearRect(0, 0, width, height)
      let aim: ThrowScene['aim'] = null
      if (phase === 'aimX' || phase === 'aimY') frameLog.record({ drawnAt: now, shownMs: elapsed })
      if (phase === 'aimX' && propsRef.current.enabled) {
        aim = {
          x: sweepPosition(elapsed, puzzle.sweepSpeed),
          y: null,
          xLocked: false,
          yLocked: false,
          sinceLandedMs: null,
        }
      } else if (phase === 'aimY') {
        aim = {
          x: aimPoint({ lockX, lockY: lockX }, puzzle.sweepSpeed).x,
          y: sweepPosition(elapsed - lockX, puzzle.sweepSpeed),
          xLocked: true,
          yLocked: false,
          sinceLandedMs: null,
        }
      } else if (phase === 'landed' && last) {
        aim = {
          ...last.result.aim,
          xLocked: true,
          yLocked: true,
          sinceLandedMs: now - last.resolvedAt,
        }
      }
      drawThrowScene(ctx, fitBoard(width, height), {
        aim,
        darts: darts.map((d) => ({
          ...d.result.landing,
          hit: d.result.hit,
          ageMs: now - d.resolvedAt,
          showScore: phase === 'landed' && d === last,
        })),
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [puzzle, startingDarts])

  // Checkout: a short shake (skipped for players who prefer reduced motion).
  useEffect(() => {
    const stack = stackRef.current
    if (!celebrate || !stack) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    stack.animate(SHAKE, { duration: 380, easing: 'ease-out' })
  }, [celebrate])

  const prompt = !enabled
    ? ''
    : phase === 'aimX'
      ? 'Tap anywhere or press Space to lock left–right'
      : phase === 'aimY'
        ? 'Tap anywhere or press Space to lock up–down'
        : 'Tap anywhere or press Space for the next dart'
  return (
    <>
      <div className="board-frame">
        <div
          ref={stackRef}
          className="board-stack"
          // The last throw's input, for debugging and end-to-end tests.
          data-last-throw={lastInput ? JSON.stringify(lastInput) : undefined}
        >
          <BoardCanvas className="layer" />
          <canvas ref={overlayRef} className="layer" aria-hidden="true" />
          {celebrate > 0 && (
            // Keyed so each checkout mounts a fresh element and replays the animation.
            <div key={celebrate} className="checkout-flash" aria-hidden="true">
              <span>CHECKOUT!</span>
            </div>
          )}
        </div>
      </div>
      <p className="muted throw-prompt">{prompt}</p>
    </>
  )
}
