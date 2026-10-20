import { describe, expect, it } from 'vitest'
import { pathFor, routeFromPath, type Route } from './routes'

const TODAY = '2026-12-15'

describe('routes', () => {
  it.each<[string, Route]>([
    ['/', { name: 'menu' }],
    ['/play', { name: 'game', mode: 'ranked', date: TODAY }],
    ['/practice', { name: 'practice' }],
    ['/practice/2026-11-20', { name: 'game', mode: 'practice', date: '2026-11-20' }],
    ['/leaderboard', { name: 'leaderboard' }],
    ['/leaderboard/2026-11-20', { name: 'leaderboard', date: '2026-11-20' }],
    ['/profile', { name: 'profile' }],
  ])('round-trips %s', (path, route) => {
    expect(routeFromPath(path, TODAY)).toEqual(route)
    expect(pathFor(route)).toBe(path)
  })

  it('ignores trailing slashes', () => {
    expect(routeFromPath('/leaderboard/', TODAY)).toEqual({ name: 'leaderboard' })
    expect(routeFromPath('/play/', TODAY)).toEqual({ name: 'game', mode: 'ranked', date: TODAY })
  })

  it.each(['/nope', '/play/extra', '/profile/x', '/a/b/c', '/index.html'])(
    'sends unknown path %s to the menu',
    (path) => {
      expect(routeFromPath(path, TODAY)).toEqual({ name: 'menu' })
    },
  )

  it("won't practise today, a future day, a day before launch, or a bad date", () => {
    for (const day of [TODAY, '2026-12-16', '2026-10-31', '2026-02-30', 'yesterday']) {
      expect(routeFromPath(`/practice/${day}`, TODAY)).toEqual({ name: 'practice' })
    }
  })

  it("won't show a leaderboard for a future day or a bad date", () => {
    expect(routeFromPath('/leaderboard/2026-12-16', TODAY)).toEqual({ name: 'leaderboard' })
    expect(routeFromPath('/leaderboard/latest', TODAY)).toEqual({ name: 'leaderboard' })
  })
})
