import { useEffect, useRef } from 'react'
import { drawBoard, fitBoard } from '../render/board'
import { setupCanvas } from '../render/canvas'

/**
 * A canvas showing the dartboard. React owns the element; src/render owns
 * what's drawn on it. Redraws when the element resizes or the device pixel
 * ratio changes (browser zoom, moving the window to another monitor).
 */
export function BoardCanvas({ className = 'board' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const { ctx, width, height } = setupCanvas(canvas)
      drawBoard(ctx, fitBoard(width, height))
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)

    // A media query that matches only the current ratio fires once when it
    // changes, so re-arm it for the new ratio each time.
    let dprQuery: MediaQueryList | null = null
    const onDprChange = () => {
      draw()
      watchDpr()
    }
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDprChange)
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      dprQuery.addEventListener('change', onDprChange)
    }
    watchDpr()

    return () => {
      resizeObserver.disconnect()
      dprQuery?.removeEventListener('change', onDprChange)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} role="img" aria-label="Dartboard" />
}
