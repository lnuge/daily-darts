/**
 * Sign-in: anonymous guest sessions, Google sign-in, and upgrading a guest
 * to Google without losing their rounds.
 *
 * A guest is a real Supabase user with `is_anonymous = true`. Upgrading links
 * a Google identity to that same user, so the user id (and every round saved
 * under it) stays the same.
 */

import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Where OAuth sends the player back to: this page. Must be in the project's redirect URLs. */
function redirectTo(): string {
  return window.location.origin + window.location.pathname
}

// The in-flight ensureSession call, shared so overlapping callers (or React's
// StrictMode running effects twice) can't each create a separate guest account.
let pendingSession: Promise<Session | null> | null = null

/**
 * The current session, starting a guest session if there's none. Null when
 * Supabase isn't configured or sign-in fails (the game still works offline).
 * Called lazily, so visitors who never play don't create accounts.
 */
export function ensureSession(): Promise<Session | null> {
  pendingSession ??= startSession().finally(() => {
    pendingSession = null
  })
  return pendingSession
}

async function startSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const { data: guest, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn('Could not start a guest session:', error.message)
    return null
  }
  return guest.session
}

/**
 * Signs in with Google, leaving the page for Google's sign-in screen. A guest
 * is upgraded in place (Google is linked to the same account). Returns an
 * error message if it couldn't start.
 */
export async function signInWithGoogle(): Promise<string | null> {
  if (!supabase) return 'Sign-in is not set up.'
  const { data } = await supabase.auth.getSession()
  const options = { redirectTo: redirectTo() }
  const { error } = data.session?.user.is_anonymous
    ? await supabase.auth.linkIdentity({ provider: 'google', options })
    : await supabase.auth.signInWithOAuth({ provider: 'google', options })
  return error?.message ?? null
}

/**
 * For when linking fails because that Google account already has its own
 * Daily Darts account: switch to it. The guest's rounds stay with the guest.
 */
export async function switchToGoogleAccount(): Promise<string | null> {
  if (!supabase) return 'Sign-in is not set up.'
  await supabase.auth.signOut()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo() },
  })
  return error?.message ?? null
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

export type AuthRedirectError = { code: string | null; message: string }

// undefined: the URL hasn't been read yet. Read once, then cached, so callers
// (and React's StrictMode double renders) all see the same answer.
let redirectError: AuthRedirectError | null | undefined

/**
 * A failed OAuth redirect comes back with the error in the URL. Reads it once
 * and removes it from the address bar, so a reload doesn't show it again.
 */
export function takeAuthRedirectError(): AuthRedirectError | null {
  // No address bar when pages are prerendered at build time.
  if (typeof window === 'undefined') return null
  if (redirectError === undefined) {
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const message = query.get('error_description') ?? hash.get('error_description')
    redirectError = message
      ? { code: query.get('error_code') ?? hash.get('error_code'), message }
      : null
    if (message) window.history.replaceState(null, '', window.location.pathname)
  }
  return redirectError
}

export function dismissAuthRedirectError(): void {
  redirectError = null
}
