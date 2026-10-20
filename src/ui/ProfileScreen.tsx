import { supabase } from '../lib/supabase'
import { AccountBar } from './AccountBar'
import { LegalLinks } from './LegalScreen'
import type { Navigate } from './App'
import { StatsPanel } from './PlayerStats'
import { usePlayerStats } from './usePlayerStats'
import { useAuth } from './useAuth'

type Props = {
  today: string
  onNavigate: Navigate
}

/** The player's name, account and stats. */
export function ProfileScreen({ today, onNavigate }: Props) {
  const auth = useAuth()
  const signedIn = auth.status === 'signed-in'
  // Only players with a session have stats; visiting doesn't create a guest account.
  const stats = usePlayerStats(signedIn, today)

  return (
    <section className="screen profile">
      <header className="title">
        <h2>{signedIn ? (auth.displayName ?? 'Profile') : 'Profile'}</h2>
        {signedIn && (
          <p className="muted">{auth.isGuest ? 'Guest player' : 'Signed in with Google'}</p>
        )}
      </header>

      {!supabase ? (
        <p className="muted">
          Stats need Supabase. Add your keys to .env.local (see docs/supabase-setup.md).
        </p>
      ) : auth.status === 'loading' ? (
        <p className="muted">Loading…</p>
      ) : !signedIn ? (
        <p className="muted">Finish today's ranked round to start your stats and streak.</p>
      ) : (
        <StatsPanel load={stats} />
      )}

      <AccountBar />

      <div className="actions">
        <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
          Menu
        </button>
      </div>
      <LegalLinks onNavigate={onNavigate} />
    </section>
  )
}
