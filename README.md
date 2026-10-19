# Daily Darts

A daily darts puzzle. Everyone gets the same board each day.

## Getting started (PowerShell)

```powershell
npm install
Copy-Item .env.example .env.local   # optional: fill in Supabase settings
npm run dev
```

Then open http://localhost:5173.

See [CLAUDE.md](./CLAUDE.md) for architecture and the determinism rules for
`src/game`.
