import type { ReactNode } from 'react'
import type { Navigate } from './App'
import { RouteLink } from './RouteLink'

/** Change this whenever either page's wording changes. */
const LAST_UPDATED = '27 October 2026'

/** Set as a build variable; see docs/deploy-cloudflare.md. */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim()

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <strong>[contact email not set: add the VITE_CONTACT_EMAIL build variable]</strong>
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
      <span aria-hidden="true">·</span>
      <RouteLink to={{ name: 'accessibility' }} onNavigate={onNavigate}>
        Accessibility
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
      <div className="topbar">
        <button className="link back" onClick={() => onNavigate({ name: 'menu' })}>
          ‹ Menu
        </button>
      </div>
      <header className="title">
        <h1>{title}</h1>
        <p className="muted">Daily Darts · last updated {LAST_UPDATED}</p>
      </header>
      <article className="legal-body">{children}</article>
      <LegalLinks onNavigate={onNavigate} />
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
        <li>
          your guest account ID and your player name: one we generate, like "Player 3F9A1C", or a
          username you choose on the Profile screen;
        </li>
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
        player name (the generated one, or the username you chose). We don't use your Google data
        for advertising, don't sell it, and don't share it with anyone except the service providers
        below, who store it for us. We don't ask for access to anything else in your Google account.
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
      <p>
        The leaderboards and the puzzle archive are public web pages that search engines can find
        and index. Each archived day lists its top ten players by player name and number of darts.
        The archive is rebuilt every day, so a new username or a deleted account shows there within
        a day (search engines may take longer to catch up).
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        Daily Darts uses no advertising, no analytics and no tracking cookies. It uses your
        browser's local storage only for the game itself, as described above. No one else collects
        information about what you do on Daily Darts to follow you across other websites.
      </p>

      <h2>We don't sell or share your information</h2>
      <p>
        We have never sold personal information, and we don't "share" it for targeted (cross-context
        behavioural) advertising, as those terms are used in US state privacy laws such as
        California's. We don't use it for profiling either. The only companies that handle it are
        the service providers below, and only to run the game for us.
      </p>

      <h2>Do Not Track and Global Privacy Control</h2>
      <p>
        Because we don't track you across sites, sell or share your information, there's nothing for
        a Do Not Track or Global Privacy Control signal to switch off. If your browser sends one, we
        treat it as a request to opt out of selling and sharing, which already applies to everyone.
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
        leaderboards stay intact, until you delete your account or ask us to. Our providers' backups
        and hosting logs are kept for a limited time (a few weeks at most) and then deleted.
      </p>

      <h2>Security</h2>
      <p>
        Everything travels over encrypted connections (HTTPS). The database only lets each player
        add their own rounds and change their own username, scores are checked on the server, and
        the keys that can change other players' data never leave our servers. We don't store
        passwords: Google handles sign-in. No system is perfectly secure; if a breach ever affects
        your personal information, we'll tell you as the law requires.
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
          To delete your account, username and every round straight away, use{' '}
          <strong>Delete my account</strong> on the Profile screen.
        </li>
        <li>
          For anything else (a copy of your data, a correction, or deleting an account you can no
          longer get into), email <Contact /> with your player name (shown on the Profile screen) or
          the email you signed in with.
        </li>
        <li>
          You can remove Daily Darts' access to your Google account at any time at{' '}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
            myaccount.google.com/connections
          </a>
          .
        </li>
      </ul>

      <h2>Your privacy rights</h2>
      <p>
        Depending on where you live (including California, Colorado, Connecticut, Virginia, Texas,
        Oregon and the other US states with privacy laws, and the UK and EU), you may have the right
        to:
      </p>
      <ul>
        <li>know what personal information we have about you, and get a copy of it;</li>
        <li>have it corrected or deleted;</li>
        <li>
          opt out of its sale, of targeted advertising and of profiling (we don't do any of these);
        </li>
        <li>not be treated differently for using these rights.</li>
      </ul>
      <p>
        Use Delete my account, or email us. You can also ask someone to make a request for you. We
        may need to check the account is yours, for example by replying from the email you signed in
        with. We'll answer within 45 days. If we turn down a request, you can appeal by replying to
        our answer, and we'll respond within 45 days of your appeal. If you're still not happy, you
        can contact your state attorney general or your local data protection authority.
      </p>

      <h2>Children</h2>
      <p>
        Daily Darts is not directed at children under 13, and we don't knowingly collect personal
        information from them. If you're under 13, please don't sign in or choose a username. If we
        learn that a child under 13 has given us personal information, we'll delete it; parents can
        email us or use Delete my account on the child's device.
      </p>
      <p>
        If you're under 18, you can remove anything you've posted (your username and your rounds on
        the leaderboard) yourself at any time with Delete my account, or by emailing us.
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

      <h2>Who can play</h2>
      <p>
        You must be at least 13 to play. If you're under 18, please read these terms with a parent
        or guardian. Signing in with Google also needs a Google account, which has its own age
        rules.
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

      <h2>No prizes, no gambling</h2>
      <p>
        Daily Darts is a free game of skill played for fun. There are no entry fees, prizes, bets or
        rewards of any kind, and nothing in the game (scores, ranks, streaks, usernames) has any
        money value or can be exchanged for anything. Please don't use it to run bets or contests of
        your own.
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
        You're responsible for activity on your account. You can delete it at any time with Delete
        my account on the Profile screen, or by asking us (see the Privacy Policy).
      </p>

      <h2>Usernames</h2>
      <p>
        Your username is public on the leaderboard. Don't choose one that is offensive, hateful or
        sexual, that impersonates someone else or Daily Darts, or that contains personal information
        such as your full name, email or phone number. We may change or remove any username, without
        notice.
      </p>

      <h2>Our content</h2>
      <p>
        The game, its design, code and puzzles belong to Daily Darts. You're welcome to share your
        results using the Share button. Please don't copy or republish the game itself. Daily Darts
        isn't affiliated with or endorsed by any darts organisation, player or broadcaster.
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
        your use of the game, and our total liability to you for any claim is limited to US$50.
        Nothing in these terms limits rights you have that can't be limited by law, including under
        consumer protection laws where you live.
      </p>

      <h2>Problems and disputes</h2>
      <p>
        If something goes wrong, please email us first: most problems can be sorted out quickly, and
        we'll try to resolve any complaint informally within 30 days.
      </p>

      <h2>General</h2>
      <p>
        If any part of these terms can't be enforced, the rest still applies. If we don't enforce a
        part straight away, we haven't given up the right to. These terms and the Privacy Policy are
        the whole agreement between you and us about Daily Darts.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  )
}

export function AccessibilityScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <LegalPage title="Accessibility" onNavigate={onNavigate}>
      <p>
        We want Daily Darts to be usable by as many people as possible. We aim to meet the Web
        Content Accessibility Guidelines (WCAG) 2.2 at level AA, and we check the site with
        automated tests and by hand when it changes.
      </p>

      <h2>What works</h2>
      <ul>
        <li>
          Everything can be done with a keyboard: <kbd>Tab</kbd> moves between buttons and links
          (with a visible outline), and <kbd>Space</kbd> stops the aim lines and throws.
        </li>
        <li>
          Screen readers read out each dart's result, busts and checkouts as they happen, and the
          score left is labelled. The menus, leaderboard, archive, rules and account pages are
          ordinary, labelled web pages.
        </li>
        <li>Text meets AA colour contrast against the board.</li>
        <li>You can zoom the page; nothing blocks pinch-zoom outside the game board.</li>
        <li>
          If your device asks for reduced motion, the board doesn't shake and the checkout animation
          is toned down. Nothing flashes more than three times a second.
        </li>
        <li>Sound is never needed to play, and can be turned off.</li>
      </ul>

      <h2>Known limitations</h2>
      <p>
        Throwing a dart means stopping a moving line at the right moment, so the game itself needs
        sight and quick reactions. That timing is the game, and we haven't found a way to remove it
        without changing what the puzzle is (WCAG allows this for real-time events). The aim lines
        move at the same speed for everyone and can't be slowed down. You can still read every
        puzzle, its best possible finish and the top scores in the archive.
      </p>

      <h2>Tell us about a problem</h2>
      <p>
        If something on the site doesn't work with the way you browse, email <Contact /> and say
        what you were trying to do and what device, browser or assistive technology you use. We aim
        to reply within five working days.
      </p>
    </LegalPage>
  )
}
