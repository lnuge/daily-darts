/**
 * Which aim line was on screen when the player tapped.
 *
 * A frame drawn at time t only reaches the screen about one frame later, and a
 * tap is handled some time after the finger touched. Locking the line where it
 * is when the tap is handled would lock it a few frames past where the player
 * saw it: at full sweep speed that's more than the width of a treble ring.
 * Instead the throw loop logs each frame it draws, and a tap locks the line
 * shown by the frame that was on screen at the tap's own timestamp.
 */

export type DrawnFrame = {
  /** performance.now() when the frame was drawn. */
  drawnAt: number
  /** Throw time (ms since the throw started) the frame showed. */
  shownMs: number
}

/** Enough to cover the slowest frame pipelines (a few hundred ms at 60 fps). */
const KEEP = 24

export class FrameLog {
  private frames: DrawnFrame[] = []

  record(frame: DrawnFrame): void {
    this.frames.push(frame)
    if (this.frames.length > KEEP) this.frames.shift()
  }

  /** Forget everything: the next phase draws a different line. */
  clear(): void {
    this.frames.length = 0
  }

  get all(): readonly DrawnFrame[] {
    return this.frames
  }
}

/** Typical time between frames, from the log: the median gap, kept within 4-34 ms. */
export function frameInterval(frames: readonly DrawnFrame[]): number {
  const gaps = frames
    .slice(1)
    .map((f, i) => f.drawnAt - frames[i].drawnAt)
    .sort((a, b) => a - b)
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 16.7
  return Math.min(34, Math.max(4, median))
}

/**
 * The throw time shown on screen at `eventTime`: the newest frame drawn at
 * least one frame interval before it (it had reached the screen), else the
 * newest frame drawn before it, else null if no frame had been drawn yet.
 */
export function shownAt(frames: readonly DrawnFrame[], eventTime: number): number | null {
  const onScreenBy = eventTime - frameInterval(frames)
  let drawn: DrawnFrame | null = null
  let visible: DrawnFrame | null = null
  for (const frame of frames) {
    if (frame.drawnAt <= eventTime) drawn = frame
    if (frame.drawnAt <= onScreenBy) visible = frame
  }
  return (visible ?? drawn)?.shownMs ?? null
}
