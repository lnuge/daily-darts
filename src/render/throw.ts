/**
 * Draws the throw overlay: sweeping aim lines, landed darts and the score
 * popup. Display only: positions and scores come from src/game/throw.ts.
 */

import { hitLabel, type Hit } from '../game/board'
import { SURROUND_RADIUS, boardToCanvas, type BoardView } from './board'

/** How long the dart takes to fly in. */
export const DART_FLIGHT_MS = 260
const IMPACT_MS = 420
const POPUP_FADE_MS = 160
const POPUP_RISE_MS = 520
/** Locked aim lines fade out over this long once the dart has landed. */
const AIM_FADE_MS = 700

/**
 * After this long, a landed dart's scene stops changing (fly-in, impact ring,
 * popup rise and aim fade are all done), so it doesn't need redrawing.
 */
export const SCENE_SETTLE_MS =
  DART_FLIGHT_MS + Math.max(IMPACT_MS, POPUP_FADE_MS, POPUP_RISE_MS, AIM_FADE_MS)

const COLORS = {
  aim: '#ffd23f',
  aimOutline: 'rgba(0, 0, 0, 0.55)',
  flight: '#2ec4ff',
  outline: '#0b0b0b',
  shaft: '#f7f7f7',
  impact: '#ffffff',
  popupBg: 'rgba(24, 30, 28, 0.9)',
  popupText: '#ffffff',
  popupScore: '#f6d86b',
  popupMiss: '#ff8a80',
} as const

export type AimOverlay = {
  /** Board x of the vertical line, or null if it isn't showing yet. */
  x: number | null
  /** Board y of the horizontal line, or null if it isn't showing yet. */
  y: number | null
  xLocked: boolean
  yLocked: boolean
  /** Time since the dart landed, to fade the locked lines out; null while aiming. */
  sinceLandedMs: number | null
}

export type LandedDart = {
  x: number
  y: number
  hit: Hit
  /** Time since the throw resolved. */
  ageMs: number
  /** Show the score popup for this dart. */
  showScore: boolean
}

export type ThrowScene = {
  aim: AimOverlay | null
  darts: readonly LandedDart[]
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3

export function drawThrowScene(
  ctx: CanvasRenderingContext2D,
  view: BoardView,
  scene: ThrowScene,
): void {
  if (scene.aim) drawAim(ctx, view, scene.aim)
  for (const dart of scene.darts) drawDart(ctx, view, dart)
  for (const dart of scene.darts) if (dart.showScore) drawScorePopup(ctx, view, dart)
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  width: number,
): void {
  // Dark underlay so the line reads on black, cream, red and green alike.
  ctx.beginPath()
  ctx.moveTo(...from)
  ctx.lineTo(...to)
  ctx.strokeStyle = COLORS.aimOutline
  ctx.lineWidth = width + 2
  ctx.stroke()
  ctx.strokeStyle = COLORS.aim
  ctx.lineWidth = width
  ctx.stroke()
}

function drawAim(ctx: CanvasRenderingContext2D, view: BoardView, aim: AimOverlay): void {
  const alpha =
    aim.sinceLandedMs === null ? 1 : 1 - clamp01((aim.sinceLandedMs - DART_FLIGHT_MS) / AIM_FADE_MS)
  if (alpha <= 0) return

  ctx.save()
  ctx.globalAlpha = alpha
  // Keep the lines on the board face rather than across the whole canvas.
  ctx.beginPath()
  ctx.arc(view.cx, view.cy, SURROUND_RADIUS * view.scale, 0, Math.PI * 2)
  ctx.clip()

  const edge = SURROUND_RADIUS
  if (aim.x !== null) {
    // Locked lines dim slightly so the line still moving stands out.
    ctx.globalAlpha = alpha * (aim.xLocked ? 0.75 : 1)
    strokeLine(
      ctx,
      boardToCanvas(view, aim.x, -edge),
      boardToCanvas(view, aim.x, edge),
      aim.xLocked ? 2 : 3,
    )
  }
  if (aim.y !== null) {
    ctx.globalAlpha = alpha * (aim.yLocked ? 0.75 : 1)
    strokeLine(
      ctx,
      boardToCanvas(view, -edge, aim.y),
      boardToCanvas(view, edge, aim.y),
      aim.yLocked ? 2 : 3,
    )
  }
  if (aim.x !== null && aim.y !== null) {
    // Ring where the lines cross: the aim point.
    const [px, py] = boardToCanvas(view, aim.x, aim.y)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(px, py, 7, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.aimOutline
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.strokeStyle = COLORS.aim
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()
}

/** Dart radius on screen: proportional to the board, but never too small to see. */
function dartRadius(view: BoardView): number {
  return Math.max(6, view.scale * 0.03)
}

/**
 * Seen from the thrower: four flights in an X around the shaft. It flies in
 * by shrinking from large and faded to its landed size, while its shadow
 * closes in underneath, then a ring pulses out on impact.
 */
function drawDart(ctx: CanvasRenderingContext2D, view: BoardView, dart: LandedDart): void {
  const [px, py] = boardToCanvas(view, dart.x, dart.y)
  const r = dartRadius(view)
  const flight = easeOutCubic(clamp01(dart.ageMs / DART_FLIGHT_MS))

  ctx.save()

  // Shadow: offset while the dart is "in the air", under it once landed.
  const shadowOffset = (1 - flight) * r * 3
  ctx.globalAlpha = 0.35 * flight
  ctx.beginPath()
  ctx.arc(px + shadowOffset, py + shadowOffset, r * 0.9, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()

  // Impact ring, after touchdown.
  const sinceImpact = dart.ageMs - DART_FLIGHT_MS
  if (sinceImpact >= 0 && sinceImpact < IMPACT_MS) {
    const p = sinceImpact / IMPACT_MS
    ctx.globalAlpha = 0.8 * (1 - p)
    ctx.beginPath()
    ctx.arc(px, py, r * (1 + 2.2 * easeOutCubic(p)), 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.impact
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const size = r * (1 + 2.2 * (1 - flight))
  ctx.globalAlpha = 0.25 + 0.75 * flight
  ctx.lineCap = 'round'
  for (const [color, width] of [
    [COLORS.outline, size * 0.62],
    [COLORS.flight, size * 0.38],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(px - size, py - size)
    ctx.lineTo(px + size, py + size)
    ctx.moveTo(px + size, py - size)
    ctx.lineTo(px - size, py + size)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(px, py, size * 0.36, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.shaft
  ctx.fill()
  ctx.strokeStyle = COLORS.outline
  ctx.lineWidth = Math.max(1.5, size * 0.1)
  ctx.stroke()

  ctx.restore()
}

/** "T20 · 60" in a pill above the dart, rising and fading in after impact. */
function drawScorePopup(ctx: CanvasRenderingContext2D, view: BoardView, dart: LandedDart): void {
  const since = dart.ageMs - DART_FLIGHT_MS
  if (since < 0) return

  const label = hitLabel(dart.hit)
  const score = dart.hit.multiplier === 0 ? '' : String(dart.hit.points)
  const fontSize = Math.max(14, Math.round(view.scale * 0.085))
  const r = dartRadius(view)
  const [px, py] = boardToCanvas(view, dart.x, dart.y)

  ctx.save()
  ctx.globalAlpha = clamp01(since / POPUP_FADE_MS)
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${fontSize}px Kalam, system-ui, -apple-system, 'Segoe UI', sans-serif`
  const gap = score ? fontSize * 0.4 : 0
  const labelWidth = ctx.measureText(label).width
  const scoreWidth = score ? ctx.measureText(score).width : 0
  const padX = fontSize * 0.6
  const width = labelWidth + gap + scoreWidth + padX * 2
  const height = fontSize * 1.7

  // Above the dart, rising a little; kept fully on the canvas.
  const rise = easeOutCubic(clamp01(since / POPUP_RISE_MS)) * fontSize * 0.8
  const canvasWidth = view.cx * 2
  const left = Math.min(Math.max(px - width / 2, 4), canvasWidth - width - 4)
  let top = py - r * 2 - height - rise
  if (top < 4) top = py + r * 2 + rise // no room above: show below instead

  ctx.beginPath()
  ctx.roundRect(left, top, width, height, height / 2)
  ctx.fillStyle = COLORS.popupBg
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.fillStyle = dart.hit.multiplier === 0 ? COLORS.popupMiss : COLORS.popupText
  ctx.fillText(label, left + padX, top + height / 2)
  if (score) {
    ctx.fillStyle = COLORS.popupScore
    ctx.fillText(score, left + padX + labelWidth + gap, top + height / 2)
  }
  ctx.restore()
}
