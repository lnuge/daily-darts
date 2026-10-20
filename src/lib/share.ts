/**
 * The spoiler-free share text, and copying it to the clipboard.
 */

import type { Rating, RoundSummary } from '../game/summary'

const RATING_EMOJI: Record<Rating, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

/**
 * For example:
 *
 *   Daily Darts #12 🎯
 *   🟢 4  🟡 7  🔴 9
 *   20 darts
 *   https://example.com
 *
 * Shows dart counts and par colours, never the targets themselves.
 */
export function buildShareText(puzzleNumber: number, summary: RoundSummary, url: string): string {
  const targets = summary.targets.map((t) => `${RATING_EMOJI[t.rating]} ${t.darts}`).join('  ')
  return [
    `Daily Darts #${puzzleNumber} 🎯`,
    targets,
    `${summary.totalDarts} ${summary.totalDarts === 1 ? 'dart' : 'darts'}`,
    url,
  ].join('\n')
}

/** Copies text to the clipboard. Returns false if the browser wouldn't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API unavailable (e.g. plain http on a LAN address): old-style fallback.
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
