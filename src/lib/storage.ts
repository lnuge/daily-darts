/**
 * Small localStorage wrapper. Storage can be unavailable (private mode,
 * blocked cookies), so every call is guarded and failures fall back to null.
 */

const PREFIX = 'daily-darts:'

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Not fatal: the game still works, it just won't remember.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Ignore.
  }
}

/** Forgets everything Daily Darts stored on this device (after deleting the account). */
export function clearAll(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Ignore.
  }
}
