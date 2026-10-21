/** Changing the player's profile (their username). */

import { supabase } from './supabase'
import { usernameErrorMessage, usernameProblem } from './username'

const listeners = new Set<() => void>()

/** Called after the player's profile changes, so every screen shows the new name. */
export function onProfileChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Sets the signed-in player's username. Returns an error message, or null on success. */
export async function setUsername(name: string): Promise<string | null> {
  const problem = usernameProblem(name)
  if (problem) return problem
  if (!supabase) return 'Usernames need Supabase.'
  const { error } = await supabase.rpc('set_username', { p_username: name.trim() })
  if (error) return usernameErrorMessage(error.message)
  for (const listener of listeners) listener()
  return null
}
