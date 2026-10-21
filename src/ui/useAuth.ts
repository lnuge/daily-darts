import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { onProfileChange } from '../lib/profile'

export type AuthState =
  /** Supabase isn't configured: the game runs offline. */
  | { status: 'disabled' }
  | { status: 'loading' }
  /** No session yet. A guest session starts the first time it's needed. */
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; isGuest: boolean; displayName: string | null }

/** The current player, kept in sync with Supabase auth. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<{ userId: string; isGuest: boolean } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [displayName, setDisplayName] = useState<{ userId: string; name: string } | null>(null)

  useEffect(() => {
    if (!supabase) return
    const apply = (user: { id: string; is_anonymous?: boolean } | null | undefined) => {
      setSession(user ? { userId: user.id, isGuest: user.is_anonymous ?? false } : null)
      setLoaded(true)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user))
    // Keep this callback synchronous: Supabase warns that calling other
    // Supabase methods inside it can deadlock. The profile loads below.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => apply(s?.user))
    return () => data.subscription.unsubscribe()
  }, [])

  // Bumped when the player renames themselves, to load the new name.
  const [profileVersion, setProfileVersion] = useState(0)
  useEffect(() => onProfileChange(() => setProfileVersion((v) => v + 1)), [])

  const userId = session?.userId
  useEffect(() => {
    if (!supabase || !userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setDisplayName({ userId, name: data.display_name as string })
      })
    return () => {
      cancelled = true
    }
  }, [userId, profileVersion])

  if (!supabase) return { status: 'disabled' }
  if (!loaded) return { status: 'loading' }
  if (!session) return { status: 'signed-out' }
  return {
    status: 'signed-in',
    ...session,
    displayName: displayName?.userId === session.userId ? displayName.name : null,
  }
}
