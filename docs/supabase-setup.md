# Supabase setup

One-time setup to connect Daily Darts to Supabase: the database tables, guest
sessions and Google sign-in. About 20 minutes. Commands are PowerShell, run from
the project folder.

The game works without any of this; it just plays offline with no accounts.

> The dashboard labels below were current when written. If a menu item has moved,
> the setting names in `supabase/config.toml` (`enable_anonymous_sign_ins`,
> `enable_manual_linking`, `[auth.external.google]`) are what to look for.

## 1. Create the project

1. Go to <https://supabase.com/dashboard> and sign in (GitHub sign-in is fine).
2. **New project**. Name it `daily-darts`, pick the region closest to most players,
   and generate a strong **database password**. Save that password in your password
   manager; step 3 asks for it.
3. Wait a minute or two while it provisions.

## 2. Put the keys in `.env.local`

1. In the project, click **Connect** (top bar), or go to **Project Settings → API Keys**.
2. Copy the **Project URL** and the **Publishable key** (`sb_publishable_...`; on older
   projects this is the `anon` key).
3. Create your env file and paste them in:

   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

4. Check git will never commit it (it should print a `.gitignore` rule):

   ```powershell
   git check-ignore -v .env.local
   ```

Never put the **secret** / `service_role` key in `.env.local` or anywhere starting with
`VITE_`. Anything named `VITE_*` is bundled into the public website.

## 3. Create the tables

The SQL is in `supabase/migrations/`. Push it with the Supabase CLI (already a dev
dependency, so `npx` runs the right version):

```powershell
npx supabase login                                  # opens the browser once
npx supabase link --project-ref your-project-ref    # the part before .supabase.co; asks for the DB password
npm run db:push                                     # applies supabase/migrations
```

Alternative without the CLI: open **SQL Editor** in the dashboard, paste the contents of
`supabase/migrations/20261020120000_profiles_and_rounds.sql`, and click **Run**. (Later
migrations would then need pasting too, so the CLI is easier in the long run.)

Check: **Table Editor** now shows `profiles` and `rounds`, each with a "RLS enabled" badge.

## 4. Turn on guest sessions and account linking

**Authentication → Sign In / Providers** (on some dashboards: Authentication → Providers):

- **Allow anonymous sign-ins**: on. Players get a guest account the first time they
  finish a ranked round, with no sign-up.
- **Allow manual linking**: on. This is what lets a guest "Sign in with Google" and keep
  the same account and rounds.

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:5173` for now (change to your real site URL when you deploy).
- **Redirect URLs**: add `http://localhost:5173` (and later your production URL).

Before launch, consider **Authentication → Attack Protection → CAPTCHA**: anonymous
sign-ins are rate limited per IP, but CAPTCHA stops scripted account creation.

## 5. Google sign-in

You need an OAuth client from Google Cloud, then paste it into Supabase.

1. In Supabase, open **Authentication → Sign In / Providers → Google** and copy the
   **Callback URL** it shows. It looks like
   `https://your-project-ref.supabase.co/auth/v1/callback`.
2. Go to <https://console.cloud.google.com/>, create a project (e.g. "Daily Darts").
3. **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform →
   Branding**): set it up as **External**, app name "Daily Darts", your support email.
   Scopes: `openid`, `email`, `profile` (the defaults).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173` (add your production URL later)
   - Authorized redirect URIs: the **Callback URL** from step 1
5. Copy the **Client ID** and **Client secret** into the Supabase Google provider panel,
   switch it **on**, and **Save**.

While the Google app is in "Testing" mode, only test users you add on the consent screen
can sign in. Publish it before launch.

## 6. Try it

```powershell
npm.cmd run dev
```

1. The menu should say **Playing as a guest · Sign in with Google**.
2. Finish today's ranked round. In the dashboard, **Authentication → Users** shows a new
   anonymous user, and **Table Editor → profiles** has a row named `Player XXXXXX`. The
   results screen shows that name with a **guest** tag.
3. Click **Sign in with Google to keep your progress**. After Google, you're back as the
   same player, and in **Users** that same user now has Google as a provider (same id).

If the Google account you pick already has its own Daily Darts account, the game offers to
switch to it; rounds played as the guest stay with the guest.

## 7. Deploy the edge functions

Two edge functions run on Supabase:

- `submit-round`: finished ranked rounds are sent here; it replays the throws on the
  server and saves the verified score.
- `delete-account`: **Delete my account** on the Profile screen calls it; it deletes the
  player's auth user, which also deletes their profile and every round.

Deploy both (and apply any new migrations) with:

```powershell
npm.cmd run db:push
npm.cmd run functions:deploy
```

`db:push` also applies later migrations as they're added (for example the leaderboard
function, `get_leaderboard`). Run it after every `git pull` that adds a file to
`supabase/migrations`.

`functions:deploy` first copies the latest game code into `submit-round`, then bundles
both functions on Supabase's servers, so Docker isn't needed. Run it again whenever
`src/game` or anything in `supabase/functions` changes.

Check: in the dashboard, **Edge Functions** lists `submit-round` and `delete-account`. Finish today's round in
the game: the results screen says **✓ Score verified and saved**, and **Table Editor →
rounds** has your row with `verified = true`.

## How the data is protected

From `supabase/migrations/20261020120000_profiles_and_rounds.sql`, checked by
`supabase/tests/rls.test.ts` (runs in `npm test` on a real Postgres via PGlite):

- Anyone can read profiles and **verified** rounds (the leaderboard), except each round's
  throw `inputs`, which only the server can read (otherwise a top round could be copied).
- Signed-in players, guests included, can insert rounds **for themselves only**. They can't
  set `verified`, `id` or `created_at`, so they can't self-verify or backdate a round.
- Players can read their own rounds; nobody but the server can update or delete rounds.
- One round per player per day (`unique (user_id, puzzle_date)`).
- New players are named `Player XXXXXX`; real names from Google are never used
  automatically. Players can choose a username (3-20 letters, numbers or `_`, unique
  ignoring case, no names like `admin` or `DailyDarts`) through `set_username`, and can't
  change anything else about their profile (`20261024090000_usernames.sql`).
- Usernames go through a swear-word filter (`20261025090000_username_filter.sql`). The
  words are in the table `username_blocklist`; see **Managing usernames** below.

## Managing usernames

**Block another word:** **Table Editor → username_blocklist → Insert row**. `word` is
lower-case letters only. Set `anywhere` to:

- `true` to block it inside any name (`xBADWORDx`). Use it for words that never appear
  inside ordinary words.
- `false` to block it only as a whole word: the whole name, or a part between
  underscores, digits or capitals (`bad_word`, `BigBad`, `bad99`). Use it for short
  words that hide inside normal ones (`ass` is in `class`).

It takes effect immediately. It stops new names; it doesn't rename anyone.

**Find existing usernames that are now blocked** (SQL Editor):

```sql
select id, display_name from public.profiles
where display_name !~ ' ' and public.username_is_blocked(display_name);
```

**Rename someone:** **Table Editor → profiles**, find the row and set `display_name` back
to `Player` plus the first 6 characters of their `id` in capitals (e.g. `Player 3F9A1C`),
or to another allowed name.

**Unblock an innocent name:** no filter is perfect (`Scunthorpe` contains a swear word).
Either delete or loosen the word in `username_blocklist` (switch `anywhere` to `false`), or
set the player's name for them in **profiles**: the filter only runs when players choose
a name themselves.
