# Deploying to Cloudflare Workers

Daily Darts is a static single-page app served by a Cloudflare Worker with static
assets (no server code). Every push to `main` builds and deploys it automatically.
Supabase (database, auth, the `submit-round` function) is deployed separately.

Commands are PowerShell, run from `C:\Users\laird\code\daily-darts`.

> Dashboard labels were current when written but move around. If one has changed, look
> for the nearest match; the settings themselves (build command, build variables, custom
> domain) are what matter.

## How it's set up (already done in the repo)

- `vite.config.ts` uses `@cloudflare/vite-plugin`, so `npm run build` produces a
  Workers-ready `dist/`, and `npm run dev` / `vite preview` run in the real Workers
  runtime locally.
- `wrangler.jsonc` declares a Worker named `daily-darts` with static assets and
  `"not_found_handling": "single-page-application"`: any path that isn't a file
  (`/play`, `/practice/2026-10-15`, ...) gets `index.html`, and the app shows the right
  screen. So refreshing or sharing any page works.
- `npm run build` also prerenders the pages search engines should read (home, how to
  play, leaderboard, archive, every archived day, privacy, terms) into real HTML files
  (`dist/archive/2026-11-14.html` is served at `/archive/2026-11-14`), and writes
  `sitemap.xml` and `robots.txt`. The archive grows every day, so the site needs
  rebuilding daily: step 5.
- `npm run deploy` builds and deploys from your PC (`wrangler deploy`), handy before
  Workers Builds is connected.

## 1. Deploy Supabase first

The site needs the database and the `submit-round` function in place:

```powershell
git pull; npm.cmd install
npm.cmd run db:push            # applies any new migrations; type y
npm.cmd run functions:deploy   # syncs the game code into the function and deploys it
```

Check: Supabase dashboard → **Edge Functions** lists `submit-round`.

Run `functions:deploy` again whenever `src/game` changes (rules, scoring, throws), and
`db:push` whenever a file is added to `supabase/migrations`. Workers Builds doesn't do
these for you.

## 2. Connect the GitHub repo with Workers Builds

1. Cloudflare dashboard → **Workers & Pages** → **Create** (Create application).
2. On the **Workers** tab choose **Import a repository** (Connect to Git).
3. **Connect GitHub** and install the Cloudflare app on your account. Give it access to
   `lnuge/daily-darts` (only that repo is fine).
4. Pick `lnuge/daily-darts` and fill in:
   - **Project / Worker name:** `daily-darts`. It **must match** `"name"` in
     `wrangler.jsonc`, or the build fails.
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Non-production branch deploy command** (if shown): `npx wrangler versions upload`
   - **Root directory:** leave empty (the repo root)
5. Open **Advanced settings → Build variables** and add the variables from step 3
   below (you can also add them afterwards).
6. **Create and deploy.** Watch the build log; the first build takes a minute or two.
   The site appears at `https://daily-darts.<your-subdomain>.workers.dev`.

From now on, every push to `main` builds and deploys. Pushes to other branches build a
preview version without touching the live site.

## 3. Supabase keys at build time

Vite bakes `VITE_*` variables into the JavaScript **when it builds**, so they must be
**build variables**, not the Worker's runtime variables.

Worker `daily-darts` → **Settings → Build → Variables and secrets** (under the **Build**
section, not the top-level "Variables and Secrets", which is for code running in the
Worker; this app has none):

| Variable                        | Value                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | `https://your-project-ref.supabase.co`                                         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_...` key (or the anon key)                                |
| `VITE_SITE_URL`                 | `https://your-domain` once step 4 is done (until then, your `workers.dev` URL) |
| `VITE_CONTACT_EMAIL`            | the email shown on `/privacy` and `/terms` for questions and deletion requests |
| `NODE_VERSION`                  | `22`                                                                           |

- Use the same two Supabase values as your `.env.local`. They're public by design
  (Row Level Security protects the data). **Never** add the secret / `service_role`
  key here: anything named `VITE_*` ends up in the public site.
- `VITE_SITE_URL` sets the link in shared results and the absolute URLs that link
  previews need. No trailing slash needed.
- Changing a build variable doesn't rebuild by itself: **Deployments → … → Retry
  deployment** (or push a commit).

## 4. Attach your custom domain

The domain is already on Cloudflare, so this is a few clicks:

1. Worker `daily-darts` → **Settings → Domains & Routes → Add → Custom domain**.
2. Enter the domain, e.g. `daily-darts.com` → **Add domain**. Cloudflare creates the DNS
   record and the HTTPS certificate; it's usually live within a few minutes.
   If it complains that a DNS record already exists for that name (a parking page,
   say), delete that record under the domain's **DNS → Records** and try again.
3. Optional: add `www.daily-darts.com` the same way, or redirect it to the bare domain
   with a **Redirect Rule** on the zone.
4. Optional: under **Domains & Routes**, disable the `workers.dev` URL so there's only
   one address.

Then point everything else at the new address:

- **Cloudflare:** set the build variable `VITE_SITE_URL=https://daily-darts.com` and
  redeploy.
- **Supabase → Authentication → URL Configuration:** **Site URL**
  `https://daily-darts.com`; **Redirect URLs** add `https://daily-darts.com/**` (keep the
  localhost ones for development).
- **Google Cloud → APIs & Services → Credentials →** your OAuth client: add
  `https://daily-darts.com` to **Authorized JavaScript origins**. (The redirect URI
  stays the Supabase callback URL.) If the consent screen is still in **Testing**,
  publish it so anyone can sign in.
- **Google Cloud → Google Auth Platform → Branding:** app name `Daily Darts`, home page
  `https://daily-darts.com`, privacy policy `https://daily-darts.com/privacy`, terms
  `https://daily-darts.com/terms`, authorized domains `daily-darts.com` and
  `your-project-ref.supabase.co`. Skip the logo unless you want to go through Google's
  verification (a logo requires it).

## 5. Rebuild every day (archive and sitemap)

Every day at 18:00 UTC the previous day's puzzle has closed everywhere, and it should
join the archive and the sitemap. A small GitHub workflow
(`.github/workflows/daily-rebuild.yml`) asks Cloudflare to rebuild at 18:20 UTC. It
needs a **deploy hook**, a private URL that starts a build:

1. Cloudflare: Worker `daily-darts` → **Settings → Builds → Deploy Hooks → Create
   deploy hook**. Name it `daily rebuild`, branch `main`. Copy the URL it shows. Treat it
   like a password: anyone with it can start builds.
2. GitHub: the repository → **Settings → Secrets and variables → Actions → New
   repository secret**. Name `CLOUDFLARE_DEPLOY_HOOK_URL`, value the URL. **Add secret**.
3. Try it: GitHub → **Actions → Daily rebuild → Run workflow**. A minute later Cloudflare's
   **Deployments** list shows a new build started by the deploy hook.

GitHub pauses scheduled workflows in a repository with no commits for 60 days. If that
happens it emails you; **Actions → Daily rebuild → Enable workflow** turns it back on.

## 6. Tell Google about the site

1. Go to [Google Search Console](https://search.google.com/search-console) and add a
   **Domain** property for your domain. It gives you a TXT record: add it under the
   domain's **DNS → Records** in Cloudflare, then **Verify**.
2. **Sitemaps** → enter `sitemap.xml` → **Submit**. It should say "Success" and list the
   pages it found (home, how to play, leaderboard, archive, each archived day, privacy,
   terms).
3. **URL inspection** → paste an archive page's URL → **Test live URL** → **View tested
   page**: the HTML should contain the page's text. Then **Request indexing** for the home
   page.

Bing Webmaster Tools can import the site straight from Search Console.

## 7. Check link previews

Paste the site URL into a chat (Slack, Discord, WhatsApp, iMessage) or a preview checker
such as the Facebook Sharing Debugger or LinkedIn Post Inspector. You should see the
title **Daily Darts**, the one-line description, and the dartboard image
(`public/og-image.png`, 1200×630). Previews are cached by each service, so a fix can take
a while to show; the debuggers have a "scrape again" button.

## 8. Production checklist

Use a private/incognito window for a true first visit, and a phone for at least one
pass.

**Guest play**

- [ ] First visit shows **How to play**; after **Let's play** it doesn't come back.
- [ ] **Play**: the lines sweep, taps lock them, darts land with a thud (sound on), the
      HUD updates, busts and checkouts sound and look right.
- [ ] Close the tab mid-round, reopen: the menu says **Resume (N darts)** and the
      round continues exactly where it was.
- [ ] Refresh on `/play`, `/leaderboard`, `/practice`, `/profile`: each reloads the same
      screen (no 404). Back button works.
- [ ] **Privacy** and **Terms** at the foot of the menu open `/privacy` and `/terms`, and
      both show your contact email (not a "not set" warning).
- [ ] View the page source (Ctrl+U) of `/`, `/archive` and an archived day: the text is
      in the HTML, each has its own `<title>`, and `/sitemap.xml` lists your domain's URLs.

**Submitting a round**

- [ ] Finish today's round. Results say **✓ Score verified and saved** and show your
      stats (streak 1, rounds played 1).
- [ ] Supabase → **Authentication → Users** has a new anonymous user; **Table Editor →
      rounds** has your row with `verified = true` and the same total darts.
- [ ] Reload: the results stay locked; no second row appears.
- [ ] **Share** copies the spoiler-free text with your domain in the link.

**Google sign-in**

- [ ] On the results or profile screen, **Sign in with Google to keep your progress**
      → pick an account → you come back to the same page as the same player, without
      the GUEST tag.
- [ ] Supabase → **Users**: the same user id now lists Google as a provider; your round
      is still there and still counted.
- [ ] Sign out, then sign in with Google on another browser or phone: the profile
      shows the same stats.

**Deleting an account** (with a throwaway account: another browser, finish a round)

- [ ] Profile → **Delete my account** → **Delete everything**: it says the account is
      deleted, and the profile shows a fresh guest.
- [ ] Supabase → **Authentication → Users** no longer lists that user, and **Table
      Editor → rounds** has none of its rounds; it's gone from that day's leaderboard.

**Leaderboard**

- [ ] **Leaderboard** shows your verified round with your row highlighted, the player
      count and the average.
- [ ] ‹ and the date picker show past days; refreshing keeps the chosen day.
- [ ] With a second account (another browser), finish a round: both appear, ordered by
      darts, ties to whoever finished first.

**Midnight reset** (without waiting up: Chrome DevTools → ⋮ → **More tools →
Sensors → Location → Timezone ID**, set e.g. `Pacific/Kiritimati`, UTC+14, where it's
already tomorrow for most of the day)

- [ ] On the results screen before switching, the countdown is ticking.
- [ ] After switching the time zone and reloading: the menu shows the next date,
      **Play** starts a fresh round with new targets, and yesterday's results are still
      on the leaderboard for that date.
- [ ] Finishing that round submits fine (the server accepts any date that's "today"
      somewhere) and the streak goes up to 2.
- [ ] Switch the time zone back afterwards.

**Phone**

- [ ] No page scroll or zoom while playing; buttons easy to hit; mute toggle works.
- [ ] Adding to the home screen (Share → Add to Home Screen) shows the dartboard icon.
