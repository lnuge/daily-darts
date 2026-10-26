/**
 * Data a prerendered page was built with (src/prerender/site.tsx), embedded
 * as JSON so the app shows the same thing when it starts instead of flashing
 * "Loading…" and fetching it again.
 */

import type { Leaderboard } from '../lib/leaderboard'
import type { ArchiveScores } from './ArchiveDayScreen'

export type PrerenderData = {
  /** The page the data belongs to, like "/archive/2026-11-14". */
  path: string
  leaderboard?: Leaderboard
  archiveScores?: ArchiveScores
}

export const PRERENDER_DATA_ID = 'prerender-data'

/** The embedded data, as a <script> safe to put in a page. */
export function prerenderDataScript(data: PrerenderData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<script type="application/json" id="${PRERENDER_DATA_ID}">${json}</script>`
}

/** The data this page was built with, if it's for `path`. */
export function readPrerenderData(path: string): PrerenderData | null {
  try {
    const text = document.getElementById(PRERENDER_DATA_ID)?.textContent
    const data = text ? (JSON.parse(text) as PrerenderData) : null
    return data?.path === path ? data : null
  } catch {
    return null
  }
}
