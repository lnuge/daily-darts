/**
 * Each page's title, description and canonical path, plus the <head> tags and
 * structured data built from them. Pure: used by the prerender at build time
 * (src/prerender/site.tsx) and by the app as the player moves between screens
 * (useDocumentMeta), so both always say the same thing.
 */

import { generateDailyPuzzle } from '../game/puzzle'
import { formatLongDate, formatShortDate } from '../lib/daily'
import { pathFor, type Route } from './routes'

export const SITE_NAME = 'Daily Darts'

export type PageMeta = {
  title: string
  description: string
  /** Canonical path, like "/archive/2026-11-14". */
  path: string
}

const HOME_DESCRIPTION =
  'A free darts checkout puzzle you play in your browser. Every day everyone gets the same ' +
  'three scores: finish each one on a double in as few darts as you can.'

/** "#13", or nothing before launch (pre-launch puzzles have negative numbers). */
function puzzleTag(date: string): string {
  const n = generateDailyPuzzle(date).puzzleNumber
  return n >= 0 ? ` #${n}` : ''
}

/** "57, 104 and 141". */
function targetList(date: string): string {
  const [a, b, c] = generateDailyPuzzle(date).targets
  return `${a}, ${b} and ${c}`
}

export function metaFor(route: Route): PageMeta {
  const path = pathFor(route)
  switch (route.name) {
    case 'menu':
      return {
        title: 'Daily Darts – A New Darts Checkout Puzzle Every Day',
        description: HOME_DESCRIPTION,
        path,
      }
    case 'howToPlay':
      return {
        title: 'How to Play Daily Darts – Aiming, Doubles and Busts',
        description:
          'How Daily Darts works: stop two sweeping lines to aim, bring each score to exactly ' +
          'zero, finish on a double, avoid busts and beat par in the fewest darts.',
        path,
      }
    case 'leaderboard':
      return route.date
        ? {
            title: `Daily Darts Leaderboard for ${formatShortDate(route.date)}`,
            description:
              `Every verified round for the Daily Darts puzzle of ${formatLongDate(route.date)}, ` +
              'ranked by fewest darts.',
            path,
          }
        : {
            title: "Daily Darts Leaderboard – Today's Fewest Darts",
            description:
              "Today's Daily Darts leaderboard: every verified round ranked by fewest darts, " +
              'with ties going to whoever finished first.',
            path,
          }
    case 'archive':
      return {
        title: 'Daily Darts Archive – Every Past Puzzle',
        description:
          'Every past Daily Darts puzzle: the three checkouts, the best possible finishes and ' +
          'the top scores for each day. Play any of them again for practice.',
        path,
      }
    case 'archiveDay':
      return {
        title:
          `Daily Darts${puzzleTag(route.date)} – Checkouts ${targetList(route.date)} ` +
          `(${formatShortDate(route.date)})`,
        description:
          `The Daily Darts puzzle for ${formatLongDate(route.date)}: check out ` +
          `${targetList(route.date)}, finishing on a double. Best possible finishes, top ` +
          'scores, and a chance to play it again.',
        path,
      }
    case 'game':
      return route.mode === 'ranked'
        ? { title: "Play Today's Puzzle – Daily Darts", description: HOME_DESCRIPTION, path }
        : {
            title: `Practice: ${formatShortDate(route.date)} – Daily Darts`,
            description: `Replay the Daily Darts puzzle of ${formatLongDate(route.date)}, unranked.`,
            path,
          }
    case 'practice':
      return {
        title: 'Practice Past Puzzles – Daily Darts',
        description: 'Replay any past Daily Darts puzzle. Practice rounds are unranked.',
        path,
      }
    case 'profile':
      return {
        title: 'Your Stats – Daily Darts',
        description: 'Your Daily Darts streaks, average darts, best round and perfect checkouts.',
        path,
      }
    case 'privacy':
      return {
        title: 'Privacy Policy – Daily Darts',
        description: 'What Daily Darts collects, why, and how to delete it.',
        path,
      }
    case 'terms':
      return {
        title: 'Terms of Service – Daily Darts',
        description: 'The terms for playing Daily Darts.',
        path,
      }
  }
}

/** For attribute values and text in HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `siteUrl` without a trailing slash, like "https://dailydarts.com", or null if unknown. */
export function absoluteUrl(siteUrl: string | null, path: string): string | null {
  return siteUrl ? siteUrl.replace(/\/+$/, '') + path : null
}

type JsonLd = Record<string, unknown>

/** The site as a free browser game, for the home page. */
export function siteJsonLd(siteUrl: string | null): JsonLd[] {
  const url = absoluteUrl(siteUrl, '/')
  const image = absoluteUrl(siteUrl, '/og-image.png')
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      ...(url && { url }),
      description: HOME_DESCRIPTION,
      inLanguage: 'en',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: SITE_NAME,
      ...(url && { url }),
      ...(image && { image }),
      description: HOME_DESCRIPTION,
      genre: ['Puzzle', 'Sports', 'Darts'],
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any (runs in a web browser)',
      playMode: 'SinglePlayer',
      inLanguage: 'en',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ]
}

/** Breadcrumbs, e.g. Home › Archive › #13. Needs absolute URLs, so none without a site URL. */
export function breadcrumbJsonLd(
  siteUrl: string | null,
  trail: { name: string; path: string }[],
): JsonLd[] {
  if (!siteUrl) return []
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: absoluteUrl(siteUrl, crumb.path),
      })),
    },
  ]
}

/** The page-specific <head> tags: title, description, canonical, Open Graph, X, JSON-LD. */
export function headTags(meta: PageMeta, siteUrl: string | null, jsonLd: JsonLd[] = []): string {
  const url = absoluteUrl(siteUrl, meta.path)
  const image = absoluteUrl(siteUrl, '/og-image.png') ?? '/og-image.png'
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    url && `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    url && `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A dartboard next to the words Daily Darts" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ...jsonLd.map(
      (data) =>
        // "<" escaped so the JSON can never close the script tag early.
        `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    ),
  ]
  return tags.filter(Boolean).join('\n    ')
}
