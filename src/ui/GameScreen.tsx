import { useEffect, useRef } from 'react'
import { drawPlaceholder, setupCanvas } from '../render/canvas'
import type { Screen } from './App'

type Props = {
  dateKey: string
  onNavigate: (screen: Screen) => void
}

/** Hosts the canvas. React owns the element; src/render owns what's drawn on it. */
export function GameScreen({ dateKey, onNavigate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => drawPlaceholder(setupCanvas(canvas), dateKey)
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [dateKey])

  return (
    <section className="screen">
      <canvas ref={canvasRef} className="board" />
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate('menu')}>
          Back
        </button>
        <button onClick={() => onNavigate('results')}>Finish</button>
      </div>
    </section>
  )
}
