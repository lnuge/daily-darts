/**
 * Canvas drawing. Reads game state, never mutates it.
 */

/**
 * Match the canvas backing store to its CSS size times devicePixelRatio so
 * drawing stays sharp on high-DPI screens. Returns a context scaled so you can
 * draw in CSS pixels.
 */
export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context not available')

  const dpr = window.devicePixelRatio || 1
  const { width, height } = canvas.getBoundingClientRect()
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/** Placeholder frame until there is gameplay to draw. */
export function drawPlaceholder(ctx: CanvasRenderingContext2D, dateKey: string): void {
  const { width, height } = ctx.canvas.getBoundingClientRect()
  ctx.fillStyle = '#14301f'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#f4ecd8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('Board goes here', width / 2, height / 2 - 12)
  ctx.font = '14px system-ui, sans-serif'
  ctx.fillText(`Puzzle ${dateKey}`, width / 2, height / 2 + 14)
}
