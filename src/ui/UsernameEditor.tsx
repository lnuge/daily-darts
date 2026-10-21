import { useState, type FormEvent } from 'react'
import { setUsername } from '../lib/profile'
import { isGeneratedName, USERNAME_MAX, usernameProblem } from '../lib/username'

/** Shows the player's name with a button to choose or change their username. */
export function UsernameEditor({ name }: { name: string | null }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const generated = name === null || isGeneratedName(name)

  const open = () => {
    setValue(generated ? '' : (name ?? ''))
    setError(null)
    setEditing(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() === name) return setEditing(false)
    setBusy(true)
    const message = await setUsername(value)
    setBusy(false)
    if (message) setError(message)
    else setEditing(false)
  }

  if (!editing) {
    return (
      <button className="link" onClick={open} disabled={name === null}>
        {generated ? 'Choose a username' : 'Change username'}
      </button>
    )
  }

  // Only show the format hint as an error once there's something to judge.
  const problem = value.trim() ? usernameProblem(value) : null
  return (
    <form className="username-form" onSubmit={save} noValidate>
      <label htmlFor="username">Username</label>
      <input
        id="username"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        maxLength={USERNAME_MAX + 10}
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-describedby="username-hint"
        aria-invalid={Boolean(problem || error)}
        autoFocus
      />
      <p
        id="username-hint"
        className={problem || error ? 'submission error' : 'muted'}
        role="status"
      >
        {error ?? problem ?? '3-20 letters, numbers or _. Everyone sees it on the leaderboard.'}
      </p>
      <div className="actions">
        <button type="submit" disabled={busy || !value.trim() || Boolean(problem)}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="secondary" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
