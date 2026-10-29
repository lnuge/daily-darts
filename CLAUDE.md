# Daily Darts

A daily web game. Everyone in the world gets the same puzzle each day, seeded
from the date. Vite + React + TypeScript. The game renders on an HTML canvas;
React is only for menus, results and the leaderboard.

## The core rule: game logic is deterministic and pure

Scores are verified by having the server replay a round from the player's
inputs. That only works if the same inputs always produce the same result, on
any machine. So everything in `src/game` must be:

- **Deterministic.** Same seed + same inputs → identical state and score,
  bit for bit.
- **Pure.** No DOM, no React, no network, no storage, no clocks, no timers.
  Functions take state and inputs and return new state.

In practice:

- **Never use `Math.random()` in game logic.** Use `createRng(seed)` from
  `src/game/rng.ts`. Thread the RNG (or its `state()`) through explicitly;
  don't keep it in a module-level variable.
- **Never read the clock** (`Date`, `Date.now()`, `performance.now()`) in
  `src/game`. The daily seed comes from a date key string (`"2026-10-19"`,
  the player's local date) passed in from outside. For calendar math use
  `src/game/date.ts`, which does it with integers. Time in a round advances by explicit ticks or
  by timestamps recorded in the player's inputs, never by wall-clock reads.
- **Inputs are data.** Anything the player does that affects the outcome must
  be captured as a serializable input (e.g. `{ t, x, y }`) so the server can
  replay it. If it isn't in the inputs, it can't affect the score.
- **Watch out for floating point across engines.** `+ - * /` and `Math.sqrt`
  are exact IEEE 754 and match everywhere. `Math.sin`, `cos`, `atan2`, `exp`,
  `pow`, `log` etc. are not guaranteed to match between browsers and the
  server. Prefer integer or fixed-point math for anything that decides a
  score, or quantize results (e.g. round to integers) before they matter.
- **Don't depend on object key order from untrusted data or on `Array.sort`
  with an inconsistent comparator.** Use stable, total orderings.

ESLint enforces much of this for `src/game` (no `Math.random`, `Date`,
`window`, `document`, timers, or imports from React/`render`/`ui`/`lib`).
Don't disable those rules; restructure the code instead.

## Folder structure

| Folder          | What goes there                                                                    | May import from         |
| --------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| `src/game`      | Pure game logic: state, rules, scoring, seeded RNG. Runs in browser and server.    | nothing outside itself  |
| `src/render`    | Canvas drawing. Reads game state, never mutates it.                                | `game`                  |
| `src/ui`        | React screens: menu, game host, results, leaderboard.                              | `game`, `render`, `lib` |
| `src/lib`       | Side effects: Supabase client, localStorage, today's date key.                     | `game`                  |
| `src/prerender` | Build-time static pages, sitemap.xml, robots.txt (run by `scripts/prerender.mjs`). | `game`, `lib`, `ui`     |

The canvas game loop (requestAnimationFrame, pointer events) lives outside
`src/game`. It collects inputs, feeds them to pure game functions, and hands
the resulting state to `src/render`.

## Daily puzzle

- **Date key:** the player's local date as `YYYY-MM-DD`, from `todayKey()` in
  `src/lib/daily.ts`. Puzzles roll over at local midnight, so at any moment
  up to three dates are live somewhere on Earth (UTC-12 to UTC+14). The server
  should accept a submission for any date that is "today" in some time zone.
- **Seed:** `getDailySeed(dateKey)` in `src/game/puzzle.ts`.
- **Puzzle:** `generateDailyPuzzle(dateKey)` in `src/game/puzzle.ts` returns
  the puzzle number (days since launch, 2026-11-01 = #0), three double-out
  checkout targets (easy 40-80, medium 81-120, hard 121-170), the crosshair
  sweep speed and the aim wobble. Ranges are exported constants there.
- **RNG streams:** each puzzle field draws from its own named stream
  (``createRng(`${seed}:targets`)`` etc.). Add new fields as new streams; never
  add draws to an existing stream, or every puzzle changes.
- **Checkouts:** `src/game/checkout.ts` has the board and a solver
  (`findCheckout`, `isCheckout`). Only targets with a three-dart double-out
  finish are ever chosen; the bogey numbers 159, 162, 163, 165, 166, 168, 169
  never appear.
- **Don't change past puzzles.** Changing `hashString`, `createRng`,
  `getDailySeed`, the stream names, the ranges or the pick logic changes every
  past and future puzzle and breaks replay of stored rounds. The pinned
  snapshots in `rng.test.ts` and `puzzle.test.ts` exist to catch that. Update
  them only on purpose, and only before launch.

## Board geometry

- `src/game/board.ts`: segment order, regulation ring sizes, and
  `scoreHit(x, y)`.
- **Board coordinates:** (0, 0) is the centre, radius 1 is the outer edge of
  the double ring. y points DOWN, like the canvas, so 20 is at (0, -1). The
  renderer only needs to scale and translate.
- **Wires:** a point exactly on a ring wire scores the region inside it; a
  point exactly on a radial wire scores the segment clockwise of it.
- Scoring uses no trig. Segments are found with cross products against the
  `WIRES` unit vectors, which are hard-coded literals. Keep it that way;
  don't "simplify" it to `Math.atan2`.
- `src/render/board.ts` draws the board from those same constants, and every
  region's colour comes from `hitColor(scoreHit(...))`. Never hard-code board
  geometry in the renderer. Map pointer positions to board coordinates with
  `canvasToBoard(fitBoard(...), px, py)`, the inverse of how the board was
  drawn, so a dart scores exactly what it visually hit.

## Throws

- `src/game/throw.ts`. A throw's whole input is `{ lockX, lockY }`: whole
  milliseconds from the start of the throw to each tap (both measured from
  the throw start). `resolveThrow(puzzle, input)` turns it into the aim
  point, landing point and `Hit`. That is the function the server replays.
- Aim lines move as a triangle wave (`sweepPosition`): start at
  \-`SWEEP_EXTENT`, one edge-to-edge pass per `1000 / sweepSpeed` ms. The Y
  line starts sweeping when X locks.
- Scatter: a uniform point within `puzzle.wobble` of the aim, from the RNG
  stream `${seed}:throw:${lockX}:${lockY}`. Same day and taps, same landing.
- The UI (`src/ui/ThrowBoard.tsx`) only records taps, rounding to whole ms,
  and draws. It must never compute a landing or score itself, and the
  renderer draws aim lines with the same `sweepPosition`, so the line on
  screen is the line that locks.
- **What you see is what locks.** A tap locks the throw time of the frame that was on
  screen at the event's own `timeStamp` (`shownAt` in `src/ui/frameLog.ts`, tested): the
  newest frame drawn at least one frame interval before the tap. Using the time the
  handler runs instead locks the line 2-3 frames late, which at full sweep speed is more
  than a treble ring's width. Bots that drive the real UI by timing taps lock about one
  frame earlier than the moment they tap.
- Taps count anywhere on the page except buttons, links, inputs and dialogs, so a thumb
  needn't cover the board. While the Y line sweeps, the renderer lights up the bed under
  the crosshair and names it (`traceBed` in `src/render/board.ts`, `scoreHit` of the
  **aim** point, a preview only; the dart still scatters by the wobble). Locking plays a
  click and a tiny vibration (`playSound('lock')`, `haptic`), both off when muted.

## Round rules

- `src/game/round.ts`, a pure state machine. `applyHit(state, hit)` is the
  rules core; `playThrow` resolves taps first; `replayRound(date, inputs)`
  replays a whole round and is what the server runs. Steps report
  `outcome` (`score`/`bust`/`checkout`) and `targetDone` for the UI.
- Three targets in order. Finish on exactly 0 with a double (bullseye counts).
  Bust: below 0, leaving 1, or 0 without a double. A bust resets to the
  visit's starting score and ends the visit; the dart still counts.
- 3 darts per visit. A target ends after 30 darts (`MAX_DARTS_PER_TARGET`)
  and counts as 30, even if the 30th dart busts.
- `replayRound` throws on any invalid input or on inputs after the round
  finished. A partial input list gives an unfinished state (used to resume).
- Tests: `playRoundToFinish` in `test-helpers.ts` is a bot that finds real tap
  inputs finishing a day's round; use it for end-to-end replay tests.

## Summaries, par and sharing

- `src/game/summary.ts`: `splitVisits(steps)` groups darts into visits
  (3 darts, a bust, or the target ending closes one); `summarizeRound`
  gives total darts, per-target darts, par, rating and best visit.
- Par = fewest darts that can finish the target (`minDarts`, from the
  checkout solver) + `PAR_ALLOWANCE` (3). Rating: green at or under par,
  yellow up to `YELLOW_ALLOWANCE` (3) over, red beyond or capped.
- `src/lib/share.ts`: `buildShareText` makes the spoiler-free share text
  (dart counts and colours only, never targets). The link is
  `VITE_SITE_URL` if set, else the page origin.
- The game screen keeps the round as a list of steps and derives every
  state from it with the same pure functions the server replays.

## Saved progress, locking and practice

- `src/lib/progress.ts`: the ranked round is saved as
  `{ version: 1, inputs }` under `daily-darts:round:<date>` after every
  throw. Restoring replays the inputs with `replaySteps`; a save that fails
  to parse or replay is deleted. Never store derived state (scores etc.).
- A finished ranked round is locked: the game opens on its results, and the
  app starts there on load. This lock is client-side only; the server must
  enforce one ranked round per player per day.
- `useToday()` (`src/ui/useToday.ts`) rolls the date at local midnight
  (`puzzleEndsAt` in `src/lib/daily.ts`, DST-safe). A game keeps the date it
  started with; the results countdown targets the midnight after that date.
- Practice (`mode: 'practice'`): any day from launch to yesterday (the last
  30 days before launch). Never saved, marked "Unranked", no share.

## Commands

```
npm run dev           # dev server at http://localhost:5173
npm test              # Vitest, single run
npm run test:watch    # Vitest, watch mode
npm run lint          # ESLint
npm run format        # Prettier, write
npm run format:check  # Prettier, check only
npm run typecheck     # tsc
npm run build         # typecheck + production build
```

Before considering a change done: `npm run typecheck`, `npm run lint`,
`npm test`, `npm run format:check`.

## Testing

- Every rule in `src/game` should have Vitest tests. Tests live next to the
  code as `*.test.ts`.
- For anything that affects scoring, add a replay test: fixed seed + fixed
  input list → assert the exact final state/score.

## Supabase

- Setup guide for the developer: `docs/supabase-setup.md`.
- Client config goes in `.env.local` (all `.env*` files except `.env.example` are
  gitignored). Only the publishable key ever goes in a `VITE_` variable; the secret /
  service_role key must never reach the client. The app runs without Supabase:
  `supabase` from `src/lib/supabase.ts` is `null` when unset.
- Schema changes are new files in `supabase/migrations/` (never edit an applied one).
  Apply with `npm run db:push`. `supabase/config.toml` mirrors the intended auth
  settings (anonymous sign-ins, manual linking, Google).
- RLS is tested in `supabase/tests/rls.test.ts`: the migrations run in PGlite on a stub of
  Supabase's `auth` schema and roles. Add a test for every policy or grant change. Test
  inserts without `RETURNING` (it applies SELECT policies too and hides INSERT bugs).
- Security model: anyone reads profiles and verified rounds; players insert only their
  own rounds and only the data columns (never `verified`, `id`, `created_at`); only the
  service role updates or deletes rounds or sets `verified`.
- Usernames (`supabase/migrations/20261024090000_usernames.sql`): players rename only via
  the `set_username(p_username)` RPC (3-20 `[A-Za-z0-9_]`, unique ignoring case, reserved
  names refused; errors `username_taken`/`_invalid`/`_reserved`). Generated `Player
XXXXXX` names have a space, so they never clash with usernames and needn't be unique.
  Client: `src/lib/username.ts` (pure rules, kept in step with the SQL by `rls.test.ts`),
  `src/lib/profile.ts` (`setUsername`, `onProfileChange` so `useAuth` reloads the name),
  `UsernameEditor` on the profile screen, and a nudge on results while the name is generated.
- Swear-word filter (`20261025090000_username_filter.sql`): words in `username_blocklist`
  (`anywhere` true = inside any name, false = whole word only), checked by the internal
  `username_is_blocked(name)` inside `set_username`, which answers `username_reserved`.
  Handles capitals, camelCase/underscore/digit word breaks, extra repeated letters and
  digits for letters. The list is server-only, not in the client. Add words to
  `username-filter.test.ts` with both blocked names and innocent look-alikes.
- Account deletion: **Delete my account** on the profile (`DeleteAccount`,
  `src/lib/account.ts`) calls the `delete-account` edge function, which deletes the caller's
  auth user with the service role (`admin.auth.admin.deleteUser`, the supported way).
  `on delete cascade` removes the profile and every round (`supabase/tests/delete-account.test.ts`);
  the device then signs out and `clearAll()` wipes `daily-darts:*` storage. Any new table
  holding player data must cascade from `profiles` or `auth.users` too.
- Auth (`src/lib/auth.ts`): a guest (anonymous) session starts lazily when a ranked round
  finishes; "Sign in with Google" links Google to the guest (`linkIdentity`) so the user
  id and rounds carry over. `ensureSession` dedupes concurrent calls; keep it that way.

## Submitting rounds (edge function)

- `supabase/functions/submit-round`: `submit.ts` holds the logic (pure apart from the
  injected store and clock, tested in `supabase/tests/submit-round.test.ts`); `index.ts`
  is the Deno entry (auth via `admin.auth.getUser(token)`, insert with the service role).
- The function replays the inputs with a **synced copy** of `src/game` in
  `supabase/functions/_shared/game`. Never edit the copy: change `src/game`, then run
  `npm run sync:game`. `npm test` fails if the copy is stale.
- Because Deno needs them, relative imports inside `src/game` must end in `.ts`, and
  `src/game` must not import anything outside itself. The sync script enforces both.
- Accepted dates: "today" somewhere on Earth (UTC-12 to UTC+14), plus `GRACE_HOURS`
  after a date ends everywhere. Rejects future and closed dates, rounds that don't
  replay or don't finish, and a second round for the same day (unique constraint).
- Only the date and inputs are read from the request. `total_darts`, `per_target` and
  `verified` always come from the server's replay.
- `inputs` is hidden from anon/authenticated by column privileges (anyone could
  otherwise copy a top round's throws). Client queries on `rounds` must name columns.
- Client: `src/lib/submit.ts` + `useRoundSubmission` send a finished ranked round once,
  remember success in `daily-darts:submitted:<date>`, treat `already_submitted` as done,
  and offer a retry on network or server failure.
- Deploy: `npm run functions:deploy` (syncs first, bundles `submit-round` and
  `delete-account` server-side, no Docker).

## Leaderboard

- One RPC, `public.get_leaderboard(p_date, p_limit = 100)` in
  `supabase/migrations/20261022090000_leaderboard.sql`, returns
  `{ date, players, average_darts, top[], me }` as JSON. Client: `src/lib/leaderboard.ts`,
  screen: `src/ui/LeaderboardScreen.tsx` (route `{ name: 'leaderboard', date? }`).
- Ranking: fewest `total_darts`, then earliest `created_at` (server verification time),
  then `id`, so ranks are unique. Only verified rounds count. `top` is capped at 100;
  `me` is the caller's own entry wherever it ranks (null for visitors / didn't play).
- `security invoker`: RLS and column privileges apply, so it never touches `inputs`, and
  it returns `is_me` instead of user ids.
- Speed: everything reads `rounds_leaderboard_idx`; the `day` CTE is `not materialized`
  so the top list stops after 100 index entries. ~35 ms for 50k players on one day in
  PGlite. Keep any change index-friendly; tests in `supabase/tests/leaderboard.test.ts`.
- `supabase/tests/db.ts` sets up PGlite with the Supabase stub and all migrations; use it
  for any new database test.

## Player stats

- `public.get_player_stats(p_today)` in `supabase/migrations/20261023090000_player_stats.sql`:
  rounds played, current and best streak, average darts, best round, perfect checkouts,
  last played. Computed on every call from the caller's **verified** rounds, which only
  the server writes, so they can't be faked. Client: `src/lib/stats.ts`,
  `usePlayerStats`, `StatsGrid`/`StatsPanel`; shown on results (once the round is
  verified) and on the profile screen (route `{ name: 'profile' }`).
- Streak = consecutive puzzle dates with a verified round. Current streak counts if the
  latest run ends today or yesterday. `p_today` (the player's local date) is clamped to
  the dates that are today somewhere on Earth, so an old date can't revive a streak.
- Perfect checkout = a target finished in `checkout_min_darts.darts` for its score. That
  table is built in SQL by the migration and tested against `findCheckout` for every
  score; if the checkout rules ever change, change both.

## Look: pub chalkboard

- `src/ui/styles.css`: a slate chalkboard (inline SVG grain + smudge gradients) in a wooden
  frame on big screens; the dartboard hangs in a round wooden surround (`.board-frame`,
  sized per screen with `--board-size` so nothing scrolls). Colours are chalk tokens on
  `:root` (`--chalk`, `--chalk-dim`, `--chalk-yellow`, ...). Buttons: chalk-filled
  (default/`.primary`), chalk outline (`.secondary`), underlined (`.link`); every screen
  has "‹ Menu" in a `.topbar` instead of a Menu button at the bottom.
- Fonts are self-hosted via `@fontsource` (imported in `main.tsx`; no Google Fonts
  requests, so the privacy policy needn't change): Cabin Sketch for headings and big
  numbers, Kalam for everything else, system sans for the legal pages' long text.
- The HUD is a pub scoreboard: `chalkedScores(steps, round)` (`src/ui/scoreboard.ts`,
  tested) gives the scores chalked up for the target in play; earlier ones are crossed
  off, the live score is big.
- `public/og-image.png` and `public/apple-touch-icon.png` use this look; regenerate them
  if it changes.

## Game feel and performance

- Sound (`src/lib/sound.ts`): synthesised with Web Audio, no files. The AudioContext is
  unlocked on the first user gesture (`installAudioUnlock` in `App`); sounds are
  scheduled on the audio clock to land with the dart (`DART_FLIGHT_MS`). Mute is saved
  as `daily-darts:muted`. Which sounds play, and whether to celebrate, is the pure
  `feedbackFor(step)` in `src/lib/feedback.ts` (tested).
- Checkout: `ThrowBoard`'s `celebrate` counter triggers a Web Animations shake (skipped
  for `prefers-reduced-motion`) and a CSS "CHECKOUT!" flash. Both are transform/opacity
  only, so they run on the compositor without redrawing canvases.
- How to play: `HowToPlay` (`<dialog>`), shown on a first visit to the menu or game until
  `daily-darts:howto-seen`; the menu links to the full `/how-to-play` page. Both use
  `HowToPlaySteps`.
- Taps: `ThrowBoard` ignores taps within `MIN_TAP_GAP_MS` (120 ms) of the last one and
  non-primary pointers (second fingers). Test bots driving the real UI must keep taps at
  least that far apart (`findInput(..., minGapMs)`). Every button is at least 44x44 px;
  `touch-action` stops double-tap zoom and swipes on the board; no page scroll in game.
- Performance: the static board is drawn once; only the overlay redraws per frame, at
  most 2x DPR, and it stops drawing once the scene has settled (`SCENE_SETTLE_MS`).
  Measured on a 390x844 @3x viewport with 4x CPU throttling (after the chalkboard
  restyle): steady 60 fps, p95 frame 16.8 ms with the odd 33-50 ms frame, main thread
  ~37% busy while playing. Re-measure if you add per-frame work.

## URLs and deployment

- Every screen has a URL (`src/ui/routes.ts`, pure and tested): `/`, `/play`,
  `/practice`, `/practice/<date>`, `/leaderboard`, `/leaderboard/<date>`, `/profile`,
  `/privacy`, `/terms`, `/accessibility`, `/how-to-play`, `/archive`, `/archive/<date>`. Navigation links are
  `RouteLink` (a real `<a href>`, so crawlers follow it) wherever they aren't actions.
  `App` pushes history on navigation and listens for `popstate`; unknown or invalid
  paths fall back to the nearest screen. When tidying the URL on load, keep
  `location.search`/`hash`: OAuth returns a one-time code there.
- Hosting: Cloudflare Workers with static assets only (`wrangler.jsonc`,
  `@cloudflare/vite-plugin`), `not_found_handling: "single-page-application"` so any
  non-file path serves `index.html`. `npm run dev` and `vite preview` run in workerd.
  Deploy guide and production checklist: `docs/deploy-cloudflare.md`.
- `VITE_*` variables are baked in at build time: on Cloudflare they're **build**
  variables. `VITE_SITE_URL` also fills `%SITE_URL%` in `index.html` (Open Graph tags)
  via the `siteUrl` plugin in `vite.config.ts`.
- `public/og-image.png` (1200x630) and `public/apple-touch-icon.png` were rendered with
  the game's own `drawBoard` and stylesheet; regenerate them if the look changes.

## Search engines: prerendered pages, archive, sitemap

- `npm run build` = `tsc -b && vite build && node scripts/prerender.mjs`. The script loads
  `src/prerender/site.tsx` through Vite (so `import.meta.env` matches the build) and
  writes real HTML into `dist/` for `/`, `/how-to-play`, `/leaderboard`, `/archive`,
  `/archive/<date>` (every archived day), `/privacy`, `/terms`, `/accessibility`, plus
  `sitemap.xml` and
  `robots.txt`. Files are `dist/<path>.html`; Workers' default `html_handling` serves them
  at the clean URL (trailing slashes and `.html` redirect to it). Everything else still
  falls back to `index.html`, which is the prerendered home page.
- A page is the built `index.html` with the block between `<!--page-meta:start-->` and
  `<!--page-meta:end-->` replaced (`headTags` in `src/ui/pageMeta.ts`: title,
  description, canonical, Open Graph, X, JSON-LD) and the same React screen the app shows
  rendered into `<div id="root"><!--app--></div>` with `renderToStaticMarkup`. The app
  doesn't hydrate; `createRoot` renders afresh. Data a page was built with (scores) is
  embedded as `#prerender-data` JSON (`src/ui/prerenderData.ts`) so the app doesn't flash
  "Loading…". Screens rendered at build time must not touch `window`/`document`/storage
  during render (effects are fine), and take `nowMs`/`initial` props instead of reading the
  clock or fetching.
- `metaFor(route)` (`src/ui/pageMeta.ts`, tested) gives every page a unique title and
  description; `useDocumentMeta` applies it as the player moves around the app. Home:
  "Daily Darts – A New Darts Checkout Puzzle Every Day", JSON-LD `WebSite` + `VideoGame`
  (free, web browser); other content pages carry `BreadcrumbList`. Absolute URLs come
  from `VITE_SITE_URL`; without it there's no canonical and the sitemap is empty.
- The prerendered home page leaves out the build day's date and targets
  (`MenuScreen prerendered`); the app fills them in. The about text below the game is
  `AboutDailyDarts` (~200 words; a test keeps it between 150 and 250).
- Archive (`src/lib/archive.ts`, tested): a date joins at D+1 18:00 UTC (`ARCHIVE_DELAY_HOURS`
  = 42), once it's over everywhere and past the server's `GRACE_HOURS`, so it never
  spoils a puzzle still being played for rank and its top 10 (`ARCHIVE_TOP`) are final.
  It starts where practice starts. `ArchiveScreen` lists days by month;
  `ArchiveDayScreen` shows targets, best finish (`findCheckout`), par, top scores, "Play
  this puzzle" (practice) and previous/next links. Top scores come from `get_leaderboard`
  with the publishable key at build time; if that fails the page still builds.
- The site must be rebuilt daily for new archive pages: `.github/workflows/daily-rebuild.yml`
  POSTs a Cloudflare Workers Builds deploy hook (secret `CLOUDFLARE_DEPLOY_HOOK_URL`) at
  18:20 UTC. Setup in `docs/deploy-cloudflare.md`.

## Accessibility

- Target: WCAG 2.2 AA. Checked with axe-core on every screen (0 violations at the last
  check); re-run it after UI changes. Statement at `/accessibility` (`AccessibilityScreen`),
  which is honest that the timed throw needs sight and quick reactions (real-time
  exception).
- Text colours: `--chalk`, `--chalk-dim`, `--chalk-faded` (faded but 4.5:1) and the
  coloured chalks all pass AA on the board. `--chalk-faint` (2.4:1) is for lines and
  decoration only, never text; input borders use `--chalk-dim` (3:1 for UI components).
- Every page has one `<h1>` (the game's is `.visually-hidden`). Scrollable regions are
  focusable. Screen-reader-only text uses `.visually-hidden`, not `aria-label` on a plain
  `div`. Dialogs focus their main button.

## Security

- The GitHub repository is **public**, and so are its Actions logs. Nothing secret is ever
  committed: no `.env*` files (gitignored except `.env.example`, which has empty values),
  no Supabase secret/service-role key, Google client secret, Cloudflare token or deploy
  hook URL. Those live only in the Supabase dashboard, Cloudflare build variables and
  GitHub Actions secrets. The last full scan of every commit (Oct 2026) found none.
- Only four values reach browsers, all public by design: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, `VITE_CONTACT_EMAIL`. The service-role
  key is read only inside the edge functions (`Deno.env`).
- Security headers: the prerender writes `dist/_headers` (`securityHeaders` in
  `src/prerender/site.tsx`), which Cloudflare sends with every response: a strict
  Content-Security-Policy (own scripts, styles, fonts and images only; `connect-src` is
  the site plus the Supabase origin from `VITE_SUPABASE_URL`), `frame-ancestors 'none'` /
  `X-Frame-Options: DENY` against clickjacking, nosniff, referrer and permissions policies,
  HSTS. No inline scripts or `style=` attributes, or the CSP blocks them; a new external
  service needs adding to `connect-src` (or `img-src`, ...). `wrangler.json`,
  `.assetsignore`, `_headers` and `.dev.vars` are never served.
- Database: every `public` table has RLS on; anon/authenticated can only read, plus the
  column-limited inserts above; `security definer` functions set `search_path = ''` and
  have EXECUTE revoked from everyone who doesn't need it (including the
  `handle_new_user` trigger function).
- Keep `npm audit` at 0 (the last findings were in Cloudflare's local dev tools).

## Privacy policy and terms

- `src/ui/LegalScreen.tsx`: `/privacy` and `/terms`, linked from the menu and profile
  (`LegalLinks`). Google's OAuth consent screen links to them. The contact address is the
  build variable `VITE_CONTACT_EMAIL`. The how-to dialog never opens over these pages.
- The privacy policy describes what's actually collected (local storage keys, guest
  accounts, rounds incl. tap timings, Google name/email/picture via Supabase, host logs)
  and that nothing else is. If you add analytics, ads, cookies, new stored data or new
  providers, update it and `LAST_UPDATED` in the same change. It also says leaderboards and the
  archive (top 10 names per day) are public, indexed pages rebuilt daily.
- Written with US state laws in mind (not legal advice; a lawyer should review): CalOPPA
  (Do Not Track disclosure, no cross-site tracking), "we don't sell or share" (CCPA/CPRA
  terms), Global Privacy Control honoured, state privacy rights with a 45-day answer and an
  appeal, security and breach notice, COPPA (not for under-13s; delete on discovery),
  California's minor "eraser" right (self-serve deletion). If the site ever adds ads,
  analytics, payments or prizes, all of that needs revisiting first.
- Terms: 13+ (under 18 with a parent), no prizes/no gambling (keeps it clear of
  sweepstakes and gambling laws), fair play, usernames, no affiliation, US$50 liability
  cap, informal disputes first, severability. No governing-law clause yet (needs the
  owner's state).
- Agreement: "By playing, you agree..." in the first-visit how-to dialog and "By signing
  in, you agree..." next to every Sign in with Google (`AccountBar`), both linking the
  Terms and Privacy Policy.

## Notes

- TypeScript is pinned to 6.0.x because typescript-eslint doesn't support
  TypeScript 7 yet. Bump both together once it does.
- The developer is on Windows / PowerShell. Give shell commands in PowerShell
  syntax.
