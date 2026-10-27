/**
 * Deleting the player's account: the delete-account edge function removes the
 * account, profile and every round on the server; then this device forgets
 * the session and everything saved locally.
 */

import { FunctionsHttpError } from '@supabase/supabase-js'
import { clearAll } from './storage'
import { supabase } from './supabase'

/** Returns an error message, or null once the account is gone. */
export async function deleteAccount(): Promise<string | null> {
  if (!supabase) return 'Accounts need Supabase.'
  const { data } = await supabase.auth.getSession()
  if (!data.session) return "You're not signed in, so there's no account to delete."

  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (error) {
    const body =
      error instanceof FunctionsHttpError
        ? ((await (error.context as Response).json().catch(() => null)) as {
            message?: string
          } | null)
        : null
    return `Couldn't delete your account. ${body?.message ?? 'Check your connection and try again.'}`
  }

  // The server has already ended the session; this clears it here too.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  clearAll()
  return null
}
