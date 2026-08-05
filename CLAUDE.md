# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

Next.js 16 (App Router) + React 19 + Tailwind CSS 4. Phase 1 (Authentication & Login Screen) of
the RAAO Budget Monitoring System is implemented — see `app/lib/auth/`, `app/login/`,
`app/admin/`, `app/personnel/`, and `proxy.ts`.

**Single backend stack: the Supabase CLI**, used for both local dev and production —
`supabase start` locally, the CLI's own Docker-based deployment on the municipal server.
`supabase/config.toml` (`project_id = "raao"`) is the one source of truth for the data/auth
stack; there is no parallel hand-rolled alternative. `docker-compose.yml` builds/runs only the
Next.js `app` container, not Postgres/GoTrue/PostgREST.

The Supabase CLI stack fronts everything with a **Kong API gateway** (`http://127.0.0.1:54321`
locally). Auth requests go to `${SUPABASE_URL}/auth/v1/...` and require an `apikey` header (the
anon key) — see `app/lib/auth/gotrue.ts`. Run `supabase status` after `supabase start` to get
the API URL, anon key, and JWT secret; put them in a local (gitignored) `.env` per `.env.example`.

Auth talks to GoTrue directly via `fetch` (`app/lib/auth/gotrue.ts`) — no `@supabase/supabase-js`
dependency. The GoTrue-issued JWT is verified with `jose` (`app/lib/auth/jwt.ts`) before any
claim in it is trusted, since it reaches the app as a cookie (client-controlled input).
`supabase/seed.sql` seeds two test accounts (`admin`/`personnel`, both `@raao.local`) on
`supabase start`/`supabase db reset` — see that file's header comment before relying on its
column list against a different GoTrue version. `enable_signup` is `false` in
`supabase/config.toml`: accounts are admin-created only, no public signup.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

There is no test runner configured in `package.json` yet.

Docker (builds/runs only the Next.js `app` container — the data/auth stack is `supabase start`):
```bash
docker-compose up          # app only
```

## Architecture notes

- **App Router only** (`app/` directory) — no `pages/` router.
- `next.config.ts` sets `output: "standalone"`, and `dockerfile` runs the built app via
  `node .next/standalone/server.js`, not `next start`. Keep this pairing in mind when changing
  either the Next config or the Dockerfile.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- Styling is Tailwind CSS 4 via `@tailwindcss/postcss` (see `postcss.config.mjs`); there is no
  `tailwind.config.*` file — v4 configures via CSS (`app/globals.css`) rather than a JS config file.
- `app/layout.tsx` uses the Next.js 16 typed-routes layout prop signature
  (`LayoutProps<"/">`) rather than a hand-written `{ children }: { children: React.ReactNode }` type.
- Route protection lives in `proxy.ts` at the repo root, **not** `middleware.ts` — Next.js 16
  deprecated and renamed that file convention. Export `proxy`, not `middleware`.

## Working in this repo

Per `AGENTS.md`: this Next.js version has breaking changes from what training data assumes.
Before writing routing, data-fetching, config, or API code, read the matching guide under
`node_modules/next/dist/docs/` (`01-app/` for App Router APIs, `03-architecture/` for
higher-level concepts) rather than relying on prior Next.js knowledge.
