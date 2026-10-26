import { useState } from 'react'
import {
  dismissAuthRedirectError,
  signInWithGoogle,
  signOut,
  switchToGoogleAccount,
  takeAuthRedirectError,
  type AuthRedirectError,
} from '../lib/auth'
import { useAuth } from './useAuth'

/** Who's playing, with sign-in / upgrade / sign-out. Hidden when Supabase isn't configured. */
export function AccountBar() {
  const auth = useAuth()
  const [error, setError] = useState<AuthRedirectError | null>(takeAuthRedirectError)
  const [busy, setBusy] = useState(false)

  if (auth.status === 'disabled') return null

  const run = async (action: () => Promise<string | null | void>) => {
    setBusy(true)
    const message = await action()
    // On success the page navigates to Google, so only failures land here.
    if (message) setError({ code: null, message })
    setBusy(false)
  }

  // Linking failed because this Google account already has its own Daily Darts account.
  const alreadyLinked = error?.code === 'identity_already_exists'

  return (
    <div className="account">
      {auth.status === 'signed-out' && (
        <>
          <span className="muted">Playing as a guest</span>
          <button className="link" disabled={busy} onClick={() => run(signInWithGoogle)}>
            Sign in with Google
          </button>
        </>
      )}

      {auth.status === 'signed-in' && auth.isGuest && (
        <>
          <span className="muted">
            {auth.displayName ?? 'Guest'} <span className="tag">guest</span>
          </span>
          <button className="link" disabled={busy} onClick={() => run(signInWithGoogle)}>
            Sign in with Google to keep your progress
          </button>
        </>
      )}

      {auth.status === 'signed-in' && !auth.isGuest && (
        <>
          <span className="muted">Signed in as {auth.displayName ?? '…'}</span>
          <button className="link" disabled={busy} onClick={() => run(signOut)}>
            Sign out
          </button>
        </>
      )}

      {error && (
        <div className="account-error" role="alert">
          {alreadyLinked ? (
            <>
              <p>
                That Google account already has its own Daily Darts account. You can switch to it;
                rounds played as this guest stay with the guest.
              </p>
              <button className="link" disabled={busy} onClick={() => run(switchToGoogleAccount)}>
                Switch to that account
              </button>
            </>
          ) : (
            <p>Sign-in didn't work: {error.message}</p>
          )}
          <button
            className="link"
            onClick={() => {
              dismissAuthRedirectError()
              setError(null)
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
