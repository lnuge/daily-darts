import { useEffect, useState } from 'react'
import type { DailyPuzzle } from '../game/puzzle'
import type { Rating, RoundSummary } from '../game/summary'
import { formatCountdown, puzzleEndsAt, todayKey } from '../lib/daily'
import { buildShareText, copyText } from '../lib/share'
import { isGeneratedName } from '../lib/username'
import { AccountBar } from './AccountBar'
import { StatsPanel } from './PlayerStats'
import { useAuth } from './useAuth'
import { usePlayerStats } from './usePlayerStats'
import type { SubmissionStatus } from './useRoundSubmission'
import type { GameMode, Navigate } from './App'

type Props = {
  mode: GameMode
  puzzle: DailyPuzzle
  summary: RoundSummary
  /** How sending the round to the server went (ranked only). */
  submission?: { status: SubmissionStatus; retry: () => void }
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

/** Whether the round has been verified and saved on the server. */
function SubmissionLine({ status, retry }: { status: SubmissionStatus; retry: () => void }) {
  switch (status.kind) {
    case 'idle':
    case 'offline':
      return null
    case 'submitting':
      return (
        <p className="submission muted" role="status">
          Saving your score…
        </p>
      )
    case 'verified':
    case 'already':
      return (
        <p className="submission ok" role="status">
          ✓ Score verified and saved
        </p>
      )
    case 'rejected':
      return (
        <p className="submission error" role="status">
          Not ranked: {status.message}
        </p>
      )
    case 'failed':
      return (
        <p className="submission error" role="status">
          Couldn't save your score. {status.message}{' '}
          <button className="link" onClick={retry}>
            Try again
          </button>
        </p>
      )
  }
}

export function ResultsScreen({ mode, puzzle, summary, submission, onNavigate }: Props) {
  const ranked = mode === 'ranked'
  // Stats come from verified rounds, so load them once this round is verified
  // (and reload if that happens again, e.g. after a retry).
  const verified =
    ranked && (submission?.status.kind === 'verified' || submission?.status.kind === 'already')
  const stats = usePlayerStats(verified, todayKey(), submission?.status.kind)
  const auth = useAuth()
  // Nudge players still on a generated name to pick one for the leaderboard.
  const unnamed =
    verified && auth.status === 'signed-in' && auth.displayName && isGeneratedName(auth.displayName)
      ? auth.displayName
      : null
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

      {ranked && submission && <SubmissionLine {...submission} />}
      {verified && <StatsPanel load={stats} />}
      {unnamed && (
        <p className="muted">
          You're on the leaderboard as {unnamed}.{' '}
          <button className="link" onClick={() => onNavigate({ name: 'profile' })}>
            Choose a username
          </button>
        </p>
      )}

      {ranked ? (
        <>
          <pre className="share-preview" aria-label="Share text">
            {shareText}
          </pre>
          <div className="actions">
            <button onClick={share}>{copyState === 'copied' ? 'Copied!' : 'Share'}</button>
            <button
              className="secondary"
              onClick={() => onNavigate({ name: 'leaderboard', date: puzzle.date })}
            >
              Leaderboard
            </button>
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
          <AccountBar />
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
