/**
 * Canvas setup. Drawing code lives in sibling modules and reads game state,
 * never mutates it.
 */

export type CanvasSurface = {
  ctx: CanvasRenderingContext2D
  /** Size in CSS pixels. Draw in these units; the context is pre-scaled. */
  width: number
  height: number
}

/**
 * Match the canvas backing store to its CSS size times devicePixelRatio so
 * drawing stays sharp on high-DPI screens, and clear it. Returns a context
 * scaled so you can draw in CSS pixels.
 */
export function setupCanvas(canvas: HTMLCanvasElement): CanvasSurface {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context not available')

  const dpr = window.devicePixelRatio || 1
  const { width, height } = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(width * dpr))
  canvas.height = Math.max(1, Math.round(height * dpr))
  // Use the actual ratio after rounding so CSS pixels map exactly onto the backing store.
  ctx.setTransform(canvas.width / (width || 1), 0, 0, canvas.height / (height || 1), 0, 0)
  ctx.clearRect(0, 0, width, height)
  return { ctx, width, height }
}
