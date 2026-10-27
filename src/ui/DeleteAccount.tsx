import { useState } from 'react'
import { deleteAccount } from '../lib/account'
import type { Navigate } from './App'

/**
 * "Delete account", with a second step to confirm, for the profile screen.
 * Deletes the account, profile and every round for good.
 */
export function DeleteAccount({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean
  onNavigate: Navigate
}) {
  const [step, setStep] = useState<'closed' | 'confirm' | 'busy' | 'done'>('closed')
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setStep('busy')
    setError(null)
    const message = await deleteAccount()
    if (message) {
      setError(message)
      setStep('confirm')
    } else {
      setStep('done')
    }
  }

  // Deleting signs the player out, so stay on screen to say it's done.
  if (step !== 'done' && !signedIn) return null

  if (step === 'done') {
    return (
      <div className="delete-account" role="status">
        <p>Your account and all your rounds have been deleted.</p>
        <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
          Back to the menu
        </button>
      </div>
    )
  }

  if (step === 'closed') {
    return (
      <button className="link danger" onClick={() => setStep('confirm')}>
        Delete my account
      </button>
    )
  }

  return (
    <div className="delete-account" role="group" aria-labelledby="delete-title">
      <h2 id="delete-title">Delete your account?</h2>
      <p>
        This deletes your account, username, stats and streak, and removes every round you've played
        from the leaderboards. It can't be undone.
      </p>
      {error && (
        <p className="submission error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="danger" disabled={step === 'busy'} onClick={confirm}>
          {step === 'busy' ? 'Deleting…' : 'Delete everything'}
        </button>
        <button className="secondary" disabled={step === 'busy'} onClick={() => setStep('closed')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
