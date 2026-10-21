/**
 * Username rules: the name a player shows on the leaderboard. The server's
 * set_username (supabase/migrations/20261024090000_usernames.sql) is the
 * authority; the checks here only give instant feedback while typing, and
 * supabase/tests/rls.test.ts checks they agree with it. Pure: saving is in
 * profile.ts.
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** Names every new player gets, like "Player 3F9A1C". */
export function isGeneratedName(name: string): boolean {
  return /^Player [0-9A-F]{6}$/.test(name)
}

/** Why `name` can't be a username, or null if it looks fine (the server has the last word). */
export function usernameProblem(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`
  if (trimmed.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`
  if (!/^[A-Za-z0-9_]+$/.test(trimmed)) return 'Only letters A-Z, numbers and _ (no spaces).'
  return null
}

/** What to tell the player for an error code from set_username. */
export function usernameErrorMessage(code: string): string {
  if (code.includes('username_taken')) return 'That username is taken. Try another.'
  if (code.includes('username_reserved')) return "That username isn't allowed. Try another."
  if (code.includes('username_invalid'))
    return `Use ${USERNAME_MIN}-${USERNAME_MAX} letters A-Z, numbers or _.`
  if (code.includes('not_signed_in')) return 'Finish a ranked round first to get an account.'
  return `Couldn't save your username. ${code}`
}
