import { useEffect, useState } from 'react'
import type { DailyPuzzle } from '../game/puzzle'
import type { Rating, RoundSummary } from '../game/summary'
import { formatCountdown, puzzleEndsAt, todayKey } from '../lib/daily'
import { buildShareText, copyText } from '../lib/share'
import type { GameMode, Navigate } from './App'

type Props = {
  mode: GameMode
  puzzle: DailyPuzzle
  summary: RoundSummary
  onNavigate: Navigate
}

const RATING_TEXT: Record<Rating, string> = {
  green: 'At or under par',
  yellow: 'A little over par',
  red: 'Well over par',
}

/** The link in shared results: VITE_SITE_URL in production, else this page's origin. */
function siteUrl(): string {
  return import.meta.env.VITE_SITE_URL || window.location.origin
}

/** Counts down to the local midnight when the next puzzle unlocks, then offers it. */
function NextPuzzle({ date, onNavigate }: { date: string; onNavigate: Navigate }) {
  const endsAt = puzzleEndsAt(date).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (now >= endsAt) {
    return (
      <div className="next-puzzle">
        <p>A new puzzle is ready!</p>
        <button onClick={() => onNavigate({ name: 'game', mode: 'ranked', date: todayKey() })}>
          Play today's puzzle
        </button>
      </div>
    )
  }
  return (
    <div className="next-puzzle">
      <span className="muted">Next puzzle in</span>
      <span className="countdown" role="timer" aria-live="off">
        {formatCountdown(endsAt - now)}
      </span>
    </div>
  )
}

export function ResultsScreen({ mode, puzzle, summary, onNavigate }: Props) {
  const ranked = mode === 'ranked'
  const shareText = buildShareText(puzzle.puzzleNumber, summary, siteUrl())
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const share = async () => {
    setCopyState((await copyText(shareText)) ? 'copied' : 'failed')
  }

  return (
    <section className="screen results">
      <header className="title">
        <h2>{ranked ? 'Round complete' : 'Practice complete'}</h2>
        {ranked ? (
          <p className="muted">Daily Darts #{puzzle.puzzleNumber}</p>
        ) : (
          <p className="badge practice">Practice · {puzzle.date} · Unranked</p>
        )}
      </header>

      <div className="total">
        <span className="total-value">{summary.totalDarts}</span>
        <span className="muted">total darts</span>
      </div>

      <table className="per-target">
        <thead>
          <tr>
            <th scope="col">Target</th>
            <th scope="col">Darts</th>
            <th scope="col">Par</th>
          </tr>
        </thead>
        <tbody>
          {summary.targets.map((t, i) => (
            <tr key={i}>
              <td>{t.target}</td>
              <td>
                <span
                  className={`rating ${t.rating}`}
                  role="img"
                  aria-label={RATING_TEXT[t.rating]}
                  title={RATING_TEXT[t.rating]}
                />
                {t.darts}
                {t.outcome === 'capped' && <span className="muted"> (limit)</span>}
              </td>
              <td className="muted">{t.par}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        Best visit <strong>{summary.bestVisit}</strong>
      </p>

      {ranked ? (
        <>
          <pre className="share-preview" aria-label="Share text">
            {shareText}
          </pre>
          <div className="actions">
            <button onClick={share}>{copyState === 'copied' ? 'Copied!' : 'Share'}</button>
            <button className="secondary" onClick={() => onNavigate({ name: 'practice' })}>
              Practice
            </button>
            <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
              Menu
            </button>
          </div>
          <p className="muted" aria-live="polite">
            {copyState === 'copied'
              ? 'Copied to your clipboard.'
              : copyState === 'failed'
                ? "Couldn't copy. Select the text above instead."
                : ''}
          </p>
          <NextPuzzle date={puzzle.date} onNavigate={onNavigate} />
        </>
      ) : (
        <div className="actions">
          <button onClick={() => onNavigate({ name: 'practice' })}>Practice another day</button>
          <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
            Menu
          </button>
        </div>
      )}
    </section>
  )
}
