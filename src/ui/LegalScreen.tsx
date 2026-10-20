import type { MouseEvent, ReactNode } from 'react'
import type { Navigate } from './App'
import { pathFor, type Route } from './routes'

/** Change this whenever either page's wording changes. */
const LAST_UPDATED = '20 October 2026'

/** Set as a build variable; see docs/deploy-cloudflare.md. */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim()

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <strong>[contact email not set: add the VITE_CONTACT_EMAIL build variable]</strong>
  )
}

/**
 * A real link (so it can be opened in a new tab and crawled) that navigates
 * in-app when clicked normally.
 */
function RouteLink({
  to,
  onNavigate,
  children,
}: {
  to: Route
  onNavigate: Navigate
  children: ReactNode
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onNavigate(to)
  }
  return (
    <a href={pathFor(to)} onClick={onClick}>
      {children}
    </a>
  )
}

/** "Privacy · Terms", for the foot of the menu and profile. */
export function LegalLinks({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <nav className="legal-links" aria-label="Legal">
      <RouteLink to={{ name: 'privacy' }} onNavigate={onNavigate}>
        Privacy
      </RouteLink>
      <span aria-hidden="true">·</span>
      <RouteLink to={{ name: 'terms' }} onNavigate={onNavigate}>
        Terms
      </RouteLink>
    </nav>
  )
}

function LegalPage({
  title,
  onNavigate,
  children,
}: {
  title: string
  onNavigate: Navigate
  children: ReactNode
}) {
  return (
    <section className="screen legal">
      <header className="title">
        <h1>{title}</h1>
        <p className="muted">Daily Darts · last updated {LAST_UPDATED}</p>
      </header>
      <article className="legal-body">{children}</article>
      <LegalLinks onNavigate={onNavigate} />
      <div className="actions">
        <button className="secondary" onClick={() => onNavigate({ name: 'menu' })}>
          Menu
        </button>
      </div>
    </section>
  )
}

export function PrivacyScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <LegalPage title="Privacy Policy" onNavigate={onNavigate}>
      <p>
        Daily Darts is a free daily darts puzzle. This policy explains what information the game
        collects, why, and what you can do about it. The short version: we collect as little as we
        can, we never sell it, and there are no ads or tracking.
      </p>

      <h2>What we collect</h2>
      <h3>When you just play</h3>
      <p>
        Your progress, settings (sound, hints) and whether you've seen the how-to-play screen are
        saved in your browser's local storage, on your device only. Nothing is sent to us until you
        finish a ranked round.
      </p>

      <h3>When you finish a ranked round</h3>
      <p>
        To put your score on the leaderboard, the game creates a guest account for you. A guest
        account has no name, email or other personal details, just a random ID. We store:
      </p>
      <ul>
        <li>your guest account ID and a player name we generate, like "Player 3F9A1C";</li>
        <li>
          your round: the puzzle date, the timing of each tap (so the server can replay the round
          and check the score), the number of darts per target, and when it was submitted.
        </li>
      </ul>
      <p>A sign-in token is kept in your browser's local storage so you stay signed in.</p>

      <h3>When you sign in with Google</h3>
      <p>
        If you choose "Sign in with Google", Google shares your <strong>name</strong>,{' '}
        <strong>email address</strong>, <strong>profile picture</strong> and Google account ID with
        us. We use them only to sign you in and to recognise you on other devices, so your stats and
        streak follow you. Your rounds stay attached to the same account.
      </p>
      <p>
        We do not show your name, email or picture to other players: the leaderboard only shows your
        generated player name. We don't use your Google data for advertising, don't sell it, and
        don't share it with anyone except the service providers below, who store it for us. We don't
        ask for access to anything else in your Google account.
      </p>

      <h3>Technical logs</h3>
      <p>
        Like most websites, our hosting providers record basic request information (such as IP
        address, browser type and the pages requested) for security and to keep the service running.
        These logs are kept for a short time and aren't used to identify you.
      </p>

      <h2>What other players can see</h2>
      <p>
        On the leaderboard: your player name, how many darts your round took, and the time it was
        verified. Your tap timings, account details and email are never public.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        Daily Darts uses no advertising, no analytics and no tracking cookies. It uses your
        browser's local storage only for the game itself, as described above.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li>
          <strong>Supabase</strong> stores accounts and rounds and handles sign-in.
        </li>
        <li>
          <strong>Cloudflare</strong> hosts the website.
        </li>
        <li>
          <strong>Google</strong> provides "Sign in with Google", under{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google's privacy policy
          </a>
          .
        </li>
      </ul>
      <p>These providers may store data in countries other than your own.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and rounds while the game is running, so your stats, streak and past
        leaderboards stay intact, or until you ask us to delete them.
      </p>

      <h2>Your choices and deleting your data</h2>
      <ul>
        <li>
          You can play without ever creating an account: just don't finish a ranked round (practice
          never sends anything).
        </li>
        <li>
          To clear what's stored on your device, clear this site's data in your browser settings.
        </li>
        <li>
          To see or delete your account and all your rounds, email <Contact /> with your player name
          (shown on the Profile screen) or the email you signed in with. We'll delete them within 30
          days.
        </li>
        <li>
          You can remove Daily Darts' access to your Google account at any time at{' '}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
            myaccount.google.com/connections
          </a>
          .
        </li>
      </ul>
      <p>
        Depending on where you live, you may have further rights, such as to access, correct or
        export your data, or to complain to your local data protection authority. Email us to use
        them.
      </p>

      <h2>Children</h2>
      <p>
        Daily Darts is not directed at children under 13, and we don't knowingly collect personal
        information from them. If you think a child has signed in with Google, email us and we'll
        delete the account.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, we'll update it here and change the date at the top.</p>

      <h2>Contact</h2>
      <p>
        Questions about your privacy: <Contact />.
      </p>
    </LegalPage>
  )
}

export function TermsScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <LegalPage title="Terms of Service" onNavigate={onNavigate}>
      <p>
        These terms apply when you play Daily Darts. By playing, you agree to them. If you don't
        agree, please don't use the game.
      </p>

      <h2>The game</h2>
      <p>
        Daily Darts is a free puzzle game: one ranked round per day, plus practice rounds of past
        days. You can play as a guest or sign in with Google to keep your progress across devices.
        How we handle your information is covered by our{' '}
        <RouteLink to={{ name: 'privacy' }} onNavigate={onNavigate}>
          Privacy Policy
        </RouteLink>
        .
      </p>

      <h2>Fair play</h2>
      <p>The leaderboard only works if everyone plays fairly. You agree not to:</p>
      <ul>
        <li>use bots, scripts or other automation to play or submit rounds;</li>
        <li>tamper with the game, its requests or its data to change a score;</li>
        <li>create multiple accounts to get extra ranked rounds;</li>
        <li>attack, overload or try to break into the service.</li>
      </ul>
      <p>
        We may remove rounds or accounts that break these rules, or that we reasonably believe
        weren't played fairly, without notice.
      </p>

      <h2>Your account</h2>
      <p>
        You're responsible for activity on your account. Player names are generated by the game. You
        can ask us to delete your account at any time (see the Privacy Policy).
      </p>

      <h2>Our content</h2>
      <p>
        The game, its design, code and puzzles belong to Daily Darts. You're welcome to share your
        results using the Share button. Please don't copy or republish the game itself.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We try to keep Daily Darts running, but we can't promise it will always be available or
        error-free. We may change, pause or end the game, or reset leaderboards, at any time. We may
        update these terms; the date at the top shows when they last changed, and continuing to play
        means you accept the new version.
      </p>

      <h2>No warranty</h2>
      <p>
        Daily Darts is provided "as is" and "as available", without warranties of any kind, to the
        extent the law allows.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, Daily Darts and the people who run it aren't liable for any
        indirect or consequential loss, or for any loss of data, scores or streaks, arising from
        your use of the game. Nothing in these terms limits rights you have that can't be limited by
        law.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  )
}
