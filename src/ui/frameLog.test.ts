import { describe, expect, it } from 'vitest'
import { FrameLog, frameInterval, shownAt, type DrawnFrame } from './frameLog'

/** Frames every `gap` ms from `from`, each showing the throw time it was drawn at. */
function frames(from: number, count: number, gap = 16.7, start = 0): DrawnFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const drawnAt = from + i * gap
    return { drawnAt, shownMs: drawnAt - start }
  })
}

describe('frameInterval', () => {
  it('is the median gap between frames', () => {
    expect(frameInterval(frames(1000, 10, 16.7))).toBeCloseTo(16.7)
    expect(frameInterval(frames(1000, 10, 8.3))).toBeCloseTo(8.3)
  })

  it('ignores the odd slow frame', () => {
    const log = frames(1000, 10, 16.7)
    log.push({ drawnAt: log[9].drawnAt + 120, shownMs: 0 })
    expect(frameInterval(log)).toBeCloseTo(16.7)
  })

  it('assumes 60 fps with too few frames, and stays within 4-34 ms', () => {
    expect(frameInterval([])).toBeCloseTo(16.7)
    expect(frameInterval(frames(0, 5, 1))).toBe(4)
    expect(frameInterval(frames(0, 5, 100))).toBe(34)
  })
})

describe('shownAt', () => {
  const log = frames(1000, 10, 16.7, 1000) // drawn at 1000, 1016.7, ... showing 0, 16.7, ...

  it('picks the frame that had reached the screen when the tap happened', () => {
    // Tapped at 1100: the frame drawn at 1083.5 is still on its way; 1066.8 is showing.
    expect(shownAt(log, 1100)).toBeCloseTo(66.8)
  })

  it("is never later than the tap's own time", () => {
    for (let t = 1020; t < 1160; t += 3) {
      expect(shownAt(log, t)!).toBeLessThanOrEqual(t - 1000)
    }
  })

  it('lags the tap by about one to two frames, not more', () => {
    for (let t = 1040; t < 1160; t += 3) {
      const lag = t - 1000 - shownAt(log, t)!
      expect(lag).toBeGreaterThanOrEqual(16.7 - 1e-9)
      expect(lag).toBeLessThan(2 * 16.7)
    }
  })

  it('falls back to the newest frame drawn, then to nothing', () => {
    // Only one frame so far, drawn 5 ms before the tap.
    expect(shownAt([{ drawnAt: 995, shownMs: 40 }], 1000)).toBe(40)
    expect(shownAt([], 1000)).toBeNull()
    expect(shownAt([{ drawnAt: 1005, shownMs: 40 }], 1000)).toBeNull()
  })
})

describe('FrameLog', () => {
  it('keeps the latest frames and can be cleared', () => {
    const log = new FrameLog()
    for (const f of frames(0, 40)) log.record(f)
    expect(log.all).toHaveLength(24)
    expect(log.all[23].drawnAt).toBeCloseTo(39 * 16.7)
    log.clear()
    expect(log.all).toHaveLength(0)
  })
})
