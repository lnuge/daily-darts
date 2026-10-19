/**
 * Draws the dartboard. All geometry (ring radii, wire directions, segment
 * order) comes from src/game/board.ts, and every region's colour comes from
 * `hitColor`, so what the player sees is what `scoreHit` scores.
 */

import { RADIUS, SEGMENT_ORDER, WIRES, type Hit } from '../game/board'

export const BOARD_COLORS = {
  black: '#1c1c1c',
  cream: '#f1e4c3',
  red: '#d2322d',
  green: '#1d8a4a',
  surround: '#101010',
  wire: '#b9bcc0',
  number: '#f4f1ea',
} as const

/** Radius the numbers are centred on, in board units. */
export const NUMBER_RADIUS = 1.14
/** Outer edge of the black surround that holds the numbers. */
export const SURROUND_RADIUS = 1.28

/** Where the board sits on the canvas, in CSS pixels. */
export type BoardView = {
  cx: number
  cy: number
  /** CSS pixels per board unit. */
  scale: number
}

/** Centres the board, surround included, as large as fits in width x height. */
export function fitBoard(width: number, height: number): BoardView {
  return {
    cx: width / 2,
    cy: height / 2,
    scale: Math.min(width, height) / 2 / SURROUND_RADIUS,
  }
}

export function boardToCanvas(view: BoardView, x: number, y: number): [number, number] {
  return [view.cx + x * view.scale, view.cy + y * view.scale]
}

/** Inverse of boardToCanvas: use it to turn a tap or click into a scoreHit point. */
export function canvasToBoard(view: BoardView, px: number, py: number): [number, number] {
  return [(px - view.cx) / view.scale, (py - view.cy) / view.scale]
}

/**
 * The colour the board shows where a dart scoring `hit` lands. Alternating
 * segments are black with red doubles/trebles, or cream with green; the 20 is
 * black. Misses land on the surround.
 */
export function hitColor(hit: Hit): string {
  if (hit.multiplier === 0) return BOARD_COLORS.surround
  if (hit.segment === 25) return hit.multiplier === 2 ? BOARD_COLORS.red : BOARD_COLORS.green
  const dark = (SEGMENT_ORDER as readonly number[]).indexOf(hit.segment) % 2 === 0
  if (hit.multiplier === 1) return dark ? BOARD_COLORS.black : BOARD_COLORS.cream
  return dark ? BOARD_COLORS.red : BOARD_COLORS.green
}

/** Rings of each segment, inside out: [inner radius, outer radius, multiplier]. */
const BANDS = [
  [RADIUS.outerBull, RADIUS.tripleInner, 1],
  [RADIUS.tripleInner, RADIUS.tripleOuter, 3],
  [RADIUS.tripleOuter, RADIUS.doubleInner, 1],
  [RADIUS.doubleInner, RADIUS.doubleOuter, 2],
] as const

/** Canvas angle of a wire. Trig is fine here: this is drawing, not scoring. */
function wireAngle(k: number): number {
  const [x, y] = WIRES[k % WIRES.length]
  return Math.atan2(y, x)
}

function fillCircle(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

export function drawBoard(ctx: CanvasRenderingContext2D, view: BoardView): void {
  ctx.save()
  // From here until restore, draw in board units with (0, 0) at the centre.
  ctx.translate(view.cx, view.cy)
  ctx.scale(view.scale, view.scale)

  fillCircle(ctx, SURROUND_RADIUS, BOARD_COLORS.surround)

  SEGMENT_ORDER.forEach((segment, k) => {
    const start = wireAngle(k)
    const end = wireAngle(k + 1)
    for (const [inner, outer, multiplier] of BANDS) {
      ctx.beginPath()
      ctx.arc(0, 0, outer, start, end)
      ctx.arc(0, 0, inner, end, start, true)
      ctx.closePath()
      ctx.fillStyle = hitColor({ segment, multiplier, points: 0, isDouble: false })
      ctx.fill()
    }
  })

  fillCircle(ctx, RADIUS.outerBull, BOARD_COLORS.green)
  fillCircle(ctx, RADIUS.bullseye, BOARD_COLORS.red)

  // Wires, about 1 CSS pixel wide at any size. They also hide the hairline
  // anti-aliasing seams between neighbouring fills.
  ctx.strokeStyle = BOARD_COLORS.wire
  ctx.lineWidth = Math.max(1, view.scale * 0.006) / view.scale
  for (const r of [
    RADIUS.bullseye,
    RADIUS.outerBull,
    RADIUS.tripleInner,
    RADIUS.tripleOuter,
    RADIUS.doubleInner,
    RADIUS.doubleOuter,
  ]) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  for (const [x, y] of WIRES) {
    ctx.moveTo(x * RADIUS.outerBull, y * RADIUS.outerBull)
    ctx.lineTo(x * RADIUS.doubleOuter, y * RADIUS.doubleOuter)
  }
  ctx.stroke()

  ctx.restore()
  drawNumbers(ctx, view)
}

/**
 * Numbers sit on the bisector of their segment: the sum of its two wire
 * vectors. Drawn in CSS pixels rather than board units, because tiny font
 * sizes under a large scale transform render badly in some browsers.
 */
function drawNumbers(ctx: CanvasRenderingContext2D, view: BoardView): void {
  ctx.save()
  ctx.fillStyle = BOARD_COLORS.number
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(view.scale * 0.13)}px system-ui, -apple-system, 'Segoe UI', sans-serif`
  SEGMENT_ORDER.forEach((segment, k) => {
    const [ax, ay] = WIRES[k]
    const [bx, by] = WIRES[(k + 1) % WIRES.length]
    const length = Math.hypot(ax + bx, ay + by)
    const [px, py] = boardToCanvas(
      view,
      ((ax + bx) / length) * NUMBER_RADIUS,
      ((ay + by) / length) * NUMBER_RADIUS,
    )
    ctx.fillText(String(segment), px, py)
  })
  ctx.restore()
}
