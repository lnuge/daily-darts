import type { Navigate } from './App'
import { RouteLink } from './RouteLink'

/** What Daily Darts is and how to play: plain text below the game on the home page. */
export function AboutDailyDarts({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <section className="about" aria-labelledby="about-title">
      <h2 id="about-title">What is Daily Darts?</h2>
      <p>
        Daily Darts is a free darts puzzle you play in your browser. There's a new one every day,
        and it's the same for everyone in the world: three checkout scores, one easy, one medium and
        one hard. Bring each score down to exactly zero and finish on a double, in as few darts as
        you can.
      </p>

      <h2>How to play</h2>
      <p>
        You aim with two lines. The first sweeps left and right across the board, so tap to stop it.
        The second sweeps up and down; tap again and the dart flies to where they cross, give or
        take a little wobble. Trebles, doubles and the bull score just as they do on a real board.
        Go below zero, leave yourself on one, or reach zero without a double and you've bust, which
        puts the score back to where that visit of three darts started.
      </p>
      <p>
        Fewest darts wins. When you finish you'll see how you did against par, where you rank on the{' '}
        <RouteLink to={{ name: 'leaderboard' }} onNavigate={onNavigate}>
          leaderboard
        </RouteLink>
        , and a result you can share without giving the puzzle away. A new puzzle unlocks at
        midnight, and every past one is waiting in the{' '}
        <RouteLink to={{ name: 'archive' }} onNavigate={onNavigate}>
          archive
        </RouteLink>
        . The{' '}
        <RouteLink to={{ name: 'howToPlay' }} onNavigate={onNavigate}>
          full rules
        </RouteLink>{' '}
        cover busts, par and a few tips.
      </p>
    </section>
  )
}
