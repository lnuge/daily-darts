# Daily Darts

One darts checkout puzzle a day. Everyone gets the same three scores; finish each on a
double in the fewest darts.

## Getting started (PowerShell)

```powershell
npm install
Copy-Item .env.example .env.local   # optional: fill in Supabase settings
npm run dev
```

Then open http://localhost:5173.

## Docs

- [CLAUDE.md](./CLAUDE.md): architecture, and the determinism rules for `src/game`.
- [docs/supabase-setup.md](./docs/supabase-setup.md): database, auth and the
  `submit-round` edge function.
- [docs/deploy-cloudflare.md](./docs/deploy-cloudflare.md): deploying to Cloudflare
  Workers, the custom domain, and the production test checklist.
