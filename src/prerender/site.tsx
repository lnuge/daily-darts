/**
 * The static site built after `vite build`: real HTML for the pages search
 * engines should see (home, rules, leaderboard, archive, every archived day,
 * privacy, terms, accessibility), plus sitemap.xml, robots.txt and the
 * security headers Cloudflare sends with every page (_headers).
 *
 * Each page is the built index.html with its own <head> tags (pageMeta.ts)
 * and the same React screens the app shows, rendered to HTML. The app doesn't
 * hydrate it: when the JavaScript loads it renders the page afresh, and any
 * data the page was built with is embedded so it doesn't flash "Loading…".
 *
 * Run by scripts/prerender.mjs through Vite, so `import.meta.env` holds the
 * same VITE_* values as the build. Pure apart from `fetchScores` (passed in).
 */

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { addDays } from '../game/date'
import { generateDailyPuzzle } from '../game/puzzle'
import { ARCHIVE_TOP, archiveDates, utcDateKey } from '../lib/archive'
import { fetchLeaderboard, type Leaderboard } from '../lib/leaderboard'
import type { Navigate } from '../ui/App'
import { ArchiveDayScreen, type ArchiveScores } from '../ui/ArchiveDayScreen'
import { ArchiveScreen } from '../ui/ArchiveScreen'
import { HowToPlayPage } from '../ui/HowToPlayPage'
import { LeaderboardScreen } from '../ui/LeaderboardScreen'
import { AccessibilityScreen, PrivacyScreen, TermsScreen } from '../ui/LegalScreen'
import { MenuScreen } from '../ui/MenuScreen'
import {
  absoluteUrl,
  breadcrumbJsonLd,
  escapeHtml,
  headTags,
  metaFor,
  siteJsonLd,
  SITE_NAME,
} from '../ui/pageMeta'
import { prerenderDataScript, type PrerenderData } from '../ui/prerenderData'
import { pathFor, type Route } from '../ui/routes'

export type SiteFile = {
  /** Path inside the build output, like "archive/2026-11-14.html". */
  file: string
  contents: string
}

export type BuildSiteOptions = {
  /** The built index.html. */
  template: string
  /** The public site URL, like "https://daily-darts.com", or null if unknown. */
  siteUrl?: string | null
  /** When the site is being built; decides "today" and what's in the archive. */
  nowMs: number
  /** Top scores for a day, or null if they couldn't be loaded. */
  fetchScores?: (date: string, limit: number) => Promise<Leaderboard | null>
}

const META_START = '<!--page-meta:start-->'
const META_END = '<!--page-meta:end-->'
const ROOT = '<div id="root"><!--app--></div>'

/** Links on a static page are real hrefs; clicking them before the app starts just loads that page. */
const navigate: Navigate = () => {}

/** Default: the leaderboard RPC, with the publishable key baked into the build. */
async function supabaseScores(date: string, limit: number): Promise<Leaderboard | null> {
  try {
    return await fetchLeaderboard(date, limit)
  } catch {
    return null
  }
}

/** "/" is index.html; "/archive/2026-11-14" is archive/2026-11-14.html. */
export function fileFor(path: string): string {
  return path === '/' ? 'index.html' : `${path.slice(1)}.html`
}

/** Runs `task` over `items`, at most `limit` at a time, keeping the order. */
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await task(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function buildSite(options: BuildSiteOptions): Promise<SiteFile[]> {
  const { template, nowMs } = options
  const siteUrl = options.siteUrl === undefined ? envSiteUrl() : options.siteUrl
  const fetchScores = options.fetchScores ?? supabaseScores
  if (!template.includes(META_START) || !template.includes(META_END) || !template.includes(ROOT)) {
    throw new Error('index.html is missing the page-meta markers or the empty #root.')
  }

  const today = utcDateKey(nowMs)
  const dates = archiveDates(nowMs)
  const [todaysBoard, ...archiveBoards] = await Promise.all([
    fetchScores(today, 100),
    mapLimit(dates, 8, (date) => fetchScores(date, ARCHIVE_TOP)),
  ]).then(([board, boards]) => [board, ...boards])

  const crumbs = (...trail: { name: string; path: string }[]) =>
    breadcrumbJsonLd(siteUrl, [{ name: SITE_NAME, path: '/' }, ...trail])
  const archiveCrumb = { name: 'Archive', path: '/archive' }

  const page = (route: Route, body: ReactNode, jsonLd: object[] = [], data?: PrerenderData) => {
    const meta = metaFor(route)
    const app = renderToStaticMarkup(<main className="app">{body}</main>)
    const head = headTags(meta, siteUrl, jsonLd as Record<string, unknown>[])
    // Function replacements, so a "$&" in a player's name is just text.
    const html = template
      .replace(
        template.slice(template.indexOf(META_START), template.indexOf(META_END) + META_END.length),
        () => `${META_START}\n    ${head}\n    ${META_END}`,
      )
      .replace(ROOT, () => `<div id="root">${app}</div>${data ? prerenderDataScript(data) : ''}`)
    return { file: fileFor(meta.path), contents: html, path: meta.path }
  }

  const pages = [
    page(
      { name: 'menu' },
      <MenuScreen today={today} onNavigate={navigate} prerendered />,
      siteJsonLd(siteUrl),
    ),
    page(
      { name: 'howToPlay' },
      <HowToPlayPage today={today} onNavigate={navigate} />,
      crumbs({ name: 'How to play', path: '/how-to-play' }),
    ),
    page(
      { name: 'leaderboard' },
      <LeaderboardScreen today={today} onNavigate={navigate} initial={todaysBoard ?? undefined} />,
      crumbs({ name: 'Leaderboard', path: '/leaderboard' }),
      todaysBoard ? { path: '/leaderboard', leaderboard: todaysBoard } : undefined,
    ),
    page(
      { name: 'archive' },
      <ArchiveScreen onNavigate={navigate} nowMs={nowMs} />,
      crumbs(archiveCrumb),
    ),
    ...dates.map((date, i) => {
      const route = { name: 'archiveDay', date } as const
      const scores: ArchiveScores = archiveBoards[i] ?? 'unavailable'
      const { puzzleNumber } = generateDailyPuzzle(date)
      return page(
        route,
        <ArchiveDayScreen date={date} onNavigate={navigate} nowMs={nowMs} initial={scores} />,
        crumbs(archiveCrumb, {
          name: puzzleNumber >= 0 ? `#${puzzleNumber}` : date,
          path: pathFor(route),
        }),
        // Only real scores are worth embedding: if they failed, the app tries again.
        scores === 'unavailable' ? undefined : { path: pathFor(route), archiveScores: scores },
      )
    }),
    page({ name: 'privacy' }, <PrivacyScreen onNavigate={navigate} />),
    page({ name: 'terms' }, <TermsScreen onNavigate={navigate} />),
    page({ name: 'accessibility' }, <AccessibilityScreen onNavigate={navigate} />),
  ]

  // Pages that change every day were modified today; an archived day last
  // changed when its scores became final, the day after it was played.
  const lastmod = (path: string) => {
    const date = path.match(/^\/archive\/(\d{4}-\d{2}-\d{2})$/)?.[1]
    return date ? addDays(date, 1) : today
  }

  return [
    ...pages.map(({ file, contents }) => ({ file, contents })),
    {
      file: 'sitemap.xml',
      contents: sitemap(
        siteUrl,
        pages.map((p) => p.path),
        lastmod,
      ),
    },
    { file: 'robots.txt', contents: robots(siteUrl) },
    { file: '_headers', contents: securityHeaders(envSupabaseUrl()) },
  ]
}

function envSiteUrl(): string | null {
  return import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, '') || null
}

/** Every prerendered page. Search engines need absolute URLs, so it's empty without a site URL. */
export function sitemap(
  siteUrl: string | null,
  paths: string[],
  lastmod: (path: string) => string,
): string {
  const urls = siteUrl
    ? paths.map(
        (path) =>
          `  <url>\n    <loc>${escapeHtml(absoluteUrl(siteUrl, path)!)}</loc>\n` +
          `    <lastmod>${lastmod(path)}</lastmod>\n  </url>`,
      )
    : []
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => u + '\n').join('') +
    '</urlset>\n'
  )
}

export function robots(siteUrl: string | null): string {
  const lines = ['User-agent: *', 'Allow: /']
  if (siteUrl) lines.push('', `Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`)
  return lines.join('\n') + '\n'
}

function envSupabaseUrl(): string | null {
  return import.meta.env.VITE_SUPABASE_URL?.trim() || null
}

/**
 * Cloudflare's _headers file: security headers on every response.
 *
 * - The Content-Security-Policy lets pages run only the site's own scripts,
 *   styles, fonts and images, and talk only to the site and its Supabase
 *   project. If a cross-site scripting bug ever slipped in, injected code
 *   couldn't load anything or send data anywhere else. The prerendered JSON
 *   (JSON-LD, #prerender-data) isn't JavaScript, so it isn't affected.
 * - frame-ancestors / X-Frame-Options: no other site can show Daily Darts in
 *   a frame, so nobody can trick a player into clicking "Delete my account"
 *   through an invisible copy of the page (clickjacking).
 */
export function securityHeaders(supabaseUrl: string | null): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    // The chalkboard texture is an inline SVG data: URI in the CSS.
    "img-src 'self' data:",
    "font-src 'self'",
    ['connect-src', "'self'", supabaseOrigin].filter(Boolean).join(' '),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  const headers = [
    `Content-Security-Policy: ${csp}`,
    'X-Frame-Options: DENY',
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Strict-Transport-Security: max-age=31536000',
    'Cross-Origin-Opener-Policy: same-origin',
  ]
  return `/*\n${headers.map((h) => `  ${h}`).join('\n')}\n`
}
