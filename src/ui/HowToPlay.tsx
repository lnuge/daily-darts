import { useEffect, useRef } from 'react'
import type { Navigate } from './App'
import { RouteLink } from './RouteLink'

type Props = {
  open: boolean
  onClose: () => void
  /** For the Terms and Privacy links: closes the dialog and goes there. */
  onNavigate: Navigate
}

/**
 * A short how-to-play, shown the first time someone visits and from the menu.
 * A native <dialog>: modal, traps focus, closes with Escape.
 */
export function HowToPlay({ open, onClose, onNavigate }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Start on "Let's play" rather than the first link in the text.
      dialog.querySelector<HTMLButtonElement>('form button')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="how-to"
      aria-labelledby="how-to-title"
      onClose={onClose}
      // A tap on the backdrop (outside the content box) closes it too.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="how-to-body">
        <h2 id="how-to-title">How to play</h2>
        <HowToPlaySteps />
        <p className="agree muted">
          By playing, you agree to the{' '}
          <RouteLink to={{ name: 'terms' }} onNavigate={onNavigate}>
            Terms
          </RouteLink>{' '}
          and{' '}
          <RouteLink to={{ name: 'privacy' }} onNavigate={onNavigate}>
            Privacy Policy
          </RouteLink>
          . Finishing a ranked round puts your score and a player name on the public leaderboard.
        </p>
        <form method="dialog">
          <button autoFocus>Let's play</button>
        </form>
      </div>
    </dialog>
  )
}

/** The rules in four steps: in the dialog and on the How to play page. */
export function HowToPlaySteps() {
  return (
    <ol className="how-to-steps">
      <li>
        <strong>Three scores a day,</strong> the same for everyone. Bring each one down to exactly{' '}
        <strong>0</strong>.
      </li>
      <li>
        <strong>Tap anywhere</strong> (or press <kbd>Space</kbd>) to stop the line sweeping left and
        right, then tap again for up and down. The bed you're aiming at lights up. Your dart lands
        near where the lines cross.
      </li>
      <li>
        <strong>Finish on a double</strong> (the outer ring) or the bullseye. Going below 0, leaving
        1, or hitting 0 without a double is a <strong>bust</strong>: you go back to where that visit
        of 3 darts started.
      </li>
      <li>
        <strong>Fewest darts wins.</strong> Turn on the hint for a suggested finish. A new puzzle
        unlocks at midnight.
      </li>
    </ol>
  )
}
