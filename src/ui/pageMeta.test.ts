import { describe, expect, it } from 'vitest'
import { generateDailyPuzzle } from '../game/puzzle'
import { breadcrumbJsonLd, headTags, metaFor, siteJsonLd } from './pageMeta'
import { pathFor, type Route } from './routes'

const ROUTES: Route[] = [
  { name: 'menu' },
  { name: 'howToPlay' },
  { name: 'leaderboard' },
  { name: 'leaderboard', date: '2026-11-14' },
  { name: 'archive' },
  { name: 'archiveDay', date: '2026-11-14' },
  { name: 'archiveDay', date: '2026-11-15' },
  { name: 'game', mode: 'ranked', date: '2026-11-20' },
  { name: 'game', mode: 'practice', date: '2026-11-14' },
  { name: 'practice' },
  { name: 'profile' },
  { name: 'privacy' },
  { name: 'terms' },
]

describe('metaFor', () => {
  it('gives the home page its title', () => {
    expect(metaFor({ name: 'menu' }).title).toBe(
      'Daily Darts – A New Darts Checkout Puzzle Every Day',
    )
  })

  it('gives every page a unique title and description, and its own path', () => {
    const metas = ROUTES.map(metaFor)
    expect(new Set(metas.map((m) => m.title)).size).toBe(ROUTES.length)
    expect(new Set(metas.map((m) => m.description)).size).toBe(ROUTES.length - 1) // /play shares the home description
    metas.forEach((m, i) => expect(m.path).toBe(pathFor(ROUTES[i])))
  })

  it('keeps descriptions to a length search engines show in full', () => {
    for (const m of ROUTES.map(metaFor)) {
      expect(m.description.length).toBeLessThanOrEqual(170)
      expect(m.title.length).toBeLessThanOrEqual(70)
    }
  })

  it("names an archived day's puzzle number, targets and date", () => {
    const { targets, puzzleNumber } = generateDailyPuzzle('2026-11-14')
    const meta = metaFor({ name: 'archiveDay', date: '2026-11-14' })
    expect(meta.title).toBe(
      `Daily Darts #${puzzleNumber} – Checkouts ${targets[0]}, ${targets[1]} and ${targets[2]} (14 Nov 2026)`,
    )
    expect(meta.description).toContain('Saturday 14 November 2026')
  })

  it('leaves out negative pre-launch puzzle numbers', () => {
    expect(metaFor({ name: 'archiveDay', date: '2026-10-20' }).title).toMatch(
      /^Daily Darts – Checkouts /,
    )
  })
})

describe('headTags', () => {
  it('has absolute canonical, Open Graph and image URLs', () => {
    const tags = headTags(metaFor({ name: 'archive' }), 'https://dailydarts.example/')
    expect(tags).toContain('<link rel="canonical" href="https://dailydarts.example/archive" />')
    expect(tags).toContain(
      '<meta property="og:url" content="https://dailydarts.example/archive" />',
    )
    expect(tags).toContain(
      '<meta property="og:image" content="https://dailydarts.example/og-image.png" />',
    )
    expect(tags).toContain('<title>Daily Darts Archive – Every Past Puzzle</title>')
  })

  it('leaves out the canonical URL when the site URL is unknown', () => {
    const tags = headTags(metaFor({ name: 'menu' }), null)
    expect(tags).not.toContain('canonical')
    expect(tags).not.toContain('og:url')
  })

  it('escapes text, and JSON-LD can never close its script tag', () => {
    const tags = headTags({ title: 'A "B" & <C>', description: 'x', path: '/' }, null, [
      { name: '</script><script>alert(1)</script>' },
    ])
    expect(tags).toContain('<title>A &quot;B&quot; &amp; &lt;C&gt;</title>')
    expect(tags).not.toContain('</script><script>')
    const json = tags.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})

describe('structured data', () => {
  it('describes the site as a free browser game', () => {
    const [site, game] = siteJsonLd('https://dailydarts.example')
    expect(site).toMatchObject({ '@type': 'WebSite', url: 'https://dailydarts.example/' })
    expect(game).toMatchObject({
      '@type': 'VideoGame',
      name: 'Daily Darts',
      gamePlatform: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0' },
    })
  })

  it('builds breadcrumbs with absolute URLs, or none without a site URL', () => {
    const trail = [
      { name: 'Daily Darts', path: '/' },
      { name: 'Archive', path: '/archive' },
    ]
    expect(breadcrumbJsonLd(null, trail)).toEqual([])
    const [list] = breadcrumbJsonLd('https://dailydarts.example', trail)
    expect(list.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Daily Darts',
        item: 'https://dailydarts.example/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Archive',
        item: 'https://dailydarts.example/archive',
      },
    ])
  })
})
