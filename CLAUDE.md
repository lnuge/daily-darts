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

| Folder       | What goes there                                                                 | May import from         |
| ------------ | ------------------------------------------------------------------------------- | ----------------------- |
| `src/game`   | Pure game logic: state, rules, scoring, seeded RNG. Runs in browser and server. | nothing outside itself  |
| `src/render` | Canvas drawing. Reads game state, never mutates it.                             | `game`                  |
| `src/ui`     | React screens: menu, game host, results, leaderboard.                           | `game`, `render`, `lib` |
| `src/lib`    | Side effects: Supabase client, localStorage, today's date key.                  | `game`                  |

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
- Deploy: `npm run functions:deploy` (syncs first, bundles server-side, no Docker).

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

## Game feel and performance

- Sound (`src/lib/sound.ts`): synthesised with Web Audio, no files. The AudioContext is
  unlocked on the first user gesture (`installAudioUnlock` in `App`); sounds are
  scheduled on the audio clock to land with the dart (`DART_FLIGHT_MS`). Mute is saved
  as `daily-darts:muted`. Which sounds play, and whether to celebrate, is the pure
  `feedbackFor(step)` in `src/lib/feedback.ts` (tested).
- Checkout: `ThrowBoard`'s `celebrate` counter triggers a Web Animations shake (skipped
  for `prefers-reduced-motion`) and a CSS "CHECKOUT!" flash. Both are transform/opacity
  only, so they run on the compositor without redrawing canvases.
- How to play: `HowToPlay` (`<dialog>`), shown until `daily-darts:howto-seen`, and from
  the menu.
- Taps: `ThrowBoard` ignores taps within `MIN_TAP_GAP_MS` (120 ms) of the last one and
  non-primary pointers (second fingers). Test bots driving the real UI must keep taps at
  least that far apart (`findInput(..., minGapMs)`). Every button is at least 44x44 px;
  `touch-action` stops double-tap zoom and swipes on the board; no page scroll in game.
- Performance: the static board is drawn once; only the overlay redraws per frame, at
  most 2x DPR, and it stops drawing once the scene has settled (`SCENE_SETTLE_MS`).
  Measured on a 390x844 @3x viewport with 4x CPU throttling: steady 60 fps, worst frame
  16.8 ms, main thread ~41% busy while playing and ~1% when idle. Re-measure if you add
  per-frame work.

## URLs and deployment

- Every screen has a URL (`src/ui/routes.ts`, pure and tested): `/`, `/play`,
  `/practice`, `/practice/<date>`, `/leaderboard`, `/leaderboard/<date>`, `/profile`.
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
  the game's own `drawBoard`; regenerate them if the board's look changes.

## Notes

- TypeScript is pinned to 6.0.x because typescript-eslint doesn't support
  TypeScript 7 yet. Bump both together once it does.
- The developer is on Windows / PowerShell. Give shell commands in PowerShell
  syntax.
