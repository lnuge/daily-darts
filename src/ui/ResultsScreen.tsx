import { useState } from 'react'
import type { DailyPuzzle } from '../game/puzzle'
import type { Rating, RoundSummary } from '../game/summary'
import { buildShareText, copyText } from '../lib/share'
import type { Screen } from './App'

type Props = {
  puzzle: DailyPuzzle
  summary: RoundSummary
  onNavigate: (screen: Screen) => void
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

export function ResultsScreen({ puzzle, summary, onNavigate }: Props) {
  const shareText = buildShareText(puzzle.puzzleNumber, summary, siteUrl())
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const share = async () => {
    setCopyState((await copyText(shareText)) ? 'copied' : 'failed')
  }

  return (
    <section className="screen results">
      <header className="title">
        <h2>Round complete</h2>
        <p className="muted">Daily Darts #{puzzle.puzzleNumber}</p>
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

      <pre className="share-preview" aria-label="Share text">
        {shareText}
      </pre>

      <div className="actions">
        <button onClick={share}>{copyState === 'copied' ? 'Copied!' : 'Share'}</button>
        <button className="secondary" onClick={() => onNavigate('menu')}>
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
    </section>
  )
}
