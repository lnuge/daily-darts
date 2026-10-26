import { describe, expect, it } from 'vitest'
import { generateDailyPuzzle } from '../game/puzzle'
import { archiveDates } from '../lib/archive'
import type { Leaderboard } from '../lib/leaderboard'
import { buildSite, fileFor, type SiteFile } from './site'

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!--page-meta:start-->
    <title>Placeholder</title>
    <!--page-meta:end-->
  </head>
  <body>
    <div id="root"><!--app--></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`

const SITE = 'https://dailydarts.example'
const NOW = Date.parse('2026-11-05T20:00:00Z') // archive: 1-4 November
const DATES = ['2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01']

function board(date: string, names: string[]): Leaderboard {
  return {
    date,
    players: names.length,
    averageDarts: 12.5,
    top: names.map((displayName, i) => ({
      rank: i + 1,
      displayName,
      totalDarts: 9 + i,
      finishedAt: '2026-11-01T08:00:00Z',
      isMe: false,
    })),
    me: null,
  }
}

async function build(options: Partial<Parameters<typeof buildSite>[0]> = {}) {
  const files = await buildSite({
    template: TEMPLATE,
    siteUrl: SITE,
    nowMs: NOW,
    fetchScores: async (date) => board(date, ['Ace_Lad', 'Bob<b>$&', 'Treble_Tom']),
    ...options,
  })
  return new Map(files.map((f: SiteFile) => [f.file, f.contents]))
}

const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')

describe('buildSite', () => {
  it('builds every page, the archive days, the sitemap and robots.txt', async () => {
    const files = await build()
    expect([...files.keys()].sort()).toEqual(
      [
        'index.html',
        'how-to-play.html',
        'leaderboard.html',
        'archive.html',
        ...DATES.map((d) => `archive/${d}.html`),
        'privacy.html',
        'terms.html',
        'sitemap.xml',
        'robots.txt',
      ].sort(),
    )
    expect(archiveDates(NOW)).toEqual(DATES)
  })

  it('gives every page its own title, description and canonical URL', async () => {
    const files = await build()
    const pages = [...files].filter(([file]) => file.endsWith('.html'))
    const titles = pages.map(([, html]) => html.match(/<title>(.*?)<\/title>/)![1])
    const canonicals = pages.map(([, html]) => html.match(/rel="canonical" href="(.*?)"/)![1])
    const descriptions = pages.map(
      ([, html]) => html.match(/name="description" content="(.*?)"/)![1],
    )
    expect(new Set(titles).size).toBe(pages.length)
    expect(new Set(descriptions).size).toBe(pages.length)
    expect(new Set(canonicals).size).toBe(pages.length)
    pages.forEach(([file], i) => {
      const path = file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '')
      expect(canonicals[i]).toBe(SITE + path)
      expect(fileFor(path)).toBe(file)
    })
    for (const [, html] of pages) {
      expect(html).not.toContain('Placeholder')
      expect(html.match(/<title>/g)).toHaveLength(1)
      expect(html).toContain('<script type="module" src="/assets/index-abc.js"></script>')
      expect(html).toContain('property="og:title"')
    }
  })

  it('renders the home page with its title, JSON-LD and about text', async () => {
    const home = (await build()).get('index.html')!
    expect(home).toContain('<title>Daily Darts – A New Darts Checkout Puzzle Every Day</title>')
    const ld = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]),
    )
    expect(ld.map((d) => d['@type'])).toEqual(['WebSite', 'VideoGame'])
    expect(ld[1]).toMatchObject({ isAccessibleForFree: true, gamePlatform: 'Web browser' })

    const about = home.match(/<section class="about"[\s\S]*?<\/section>/)![0]
    const words = textOf(about).trim().split(' ').length
    expect(words).toBeGreaterThanOrEqual(150)
    expect(words).toBeLessThanOrEqual(250)
    expect(about).toContain('href="/how-to-play"')
    expect(about).toContain('href="/archive"')
  })

  it("doesn't put the build day's date or targets on the home page", async () => {
    const home = textOf((await build()).get('index.html')!)
    const { targets } = generateDailyPuzzle('2026-11-05')
    expect(home).not.toContain(targets.join(' '))
    expect(home).not.toMatch(/Thursday|November/)
  })

  it('lists every archived day and links to it', async () => {
    const archive = (await build()).get('archive.html')!
    for (const date of DATES) expect(archive).toContain(`href="/archive/${date}"`)
    expect(textOf(archive)).toContain('November 2026')
  })

  it("shows an archived day's targets, best finishes and top scores, escaped", async () => {
    const day = (await build()).get('archive/2026-11-02.html')!
    const { targets, puzzleNumber } = generateDailyPuzzle('2026-11-02')
    const text = textOf(day)
    expect(text).toContain(`Daily Darts #${puzzleNumber}`)
    expect(text).toContain('Monday 2 November 2026')
    for (const target of targets) expect(text).toContain(String(target))
    expect(text).toMatch(/Best: \d darts?,/)
    expect(text).toContain('Ace_Lad')
    expect(day).toContain('Bob&lt;b&gt;$&amp;')
    expect(day).not.toContain('Bob<b>')
    expect(day).toContain('href="/leaderboard/2026-11-02"')
    expect(day).toContain('href="/archive/2026-11-01"')
    expect(day).toContain('href="/archive/2026-11-03"')

    // The scores are embedded for the app, and can't break out of their script.
    const json = day.match(
      /<script type="application\/json" id="prerender-data">(.*?)<\/script>/,
    )![1]
    expect(JSON.parse(json)).toMatchObject({
      path: '/archive/2026-11-02',
      archiveScores: { top: [{ displayName: 'Ace_Lad' }, { displayName: 'Bob<b>$&' }, {}] },
    })
    expect(json).not.toContain('<b>')
  })

  it('still builds every page when the scores are unavailable', async () => {
    const files = await build({ fetchScores: async () => null })
    const day = files.get('archive/2026-11-02.html')!
    expect(textOf(day)).toContain('The top scores are on the full leaderboard.')
    expect(day).not.toContain('prerender-data')
    expect(files.get('leaderboard.html')).not.toContain('prerender-data')
  })

  it('writes a sitemap of every page with absolute URLs, and points robots.txt at it', async () => {
    const files = await build()
    const sitemap = files.get('sitemap.xml')!
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual([
      `${SITE}/`,
      `${SITE}/how-to-play`,
      `${SITE}/leaderboard`,
      `${SITE}/archive`,
      ...DATES.map((d) => `${SITE}/archive/${d}`),
      `${SITE}/privacy`,
      `${SITE}/terms`,
    ])
    expect(sitemap).toContain(
      `<loc>${SITE}/archive/2026-11-02</loc>\n    <lastmod>2026-11-03</lastmod>`,
    )
    expect(sitemap).toContain(`<loc>${SITE}/</loc>\n    <lastmod>2026-11-05</lastmod>`)
    expect(files.get('robots.txt')).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
    )
  })

  it('leaves out absolute URLs when the site URL is unknown', async () => {
    const files = await build({ siteUrl: null })
    expect(files.get('index.html')).not.toContain('rel="canonical"')
    expect(files.get('sitemap.xml')).not.toContain('<url>')
    expect(files.get('robots.txt')).toBe('User-agent: *\nAllow: /\n')
  })

  it('refuses a template without the markers it fills in', async () => {
    await expect(
      buildSite({
        template: '<html></html>',
        siteUrl: SITE,
        nowMs: NOW,
        fetchScores: async () => null,
      }),
    ).rejects.toThrow(/page-meta/)
  })
})
