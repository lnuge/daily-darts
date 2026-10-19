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

## Environment

Supabase config goes in `.env.local` (gitignored). See `.env.example`. The app
runs without it; `supabase` from `src/lib/supabase.ts` is `null` when unset.

## Notes

- TypeScript is pinned to 6.0.x because typescript-eslint doesn't support
  TypeScript 7 yet. Bump both together once it does.
- The developer is on Windows / PowerShell. Give shell commands in PowerShell
  syntax.
