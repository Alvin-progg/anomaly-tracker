# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

Next.js 16 (App Router) + React 19 + Tailwind CSS 4. Phase 1 (Authentication & Login Screen) of
the RAAO Budget Monitoring System is implemented — see `app/lib/auth/`, `app/login/`,
`app/admin/`, `app/personnel/`, and `proxy.ts`.

`front-end-ref/` is a **read-only Figma-exported Vite mock** of the whole system, not a build
target. Treat it as the visual spec (`src/components/PersonnelPortal.tsx` etc.) and port from it;
its numbers are illustrative and frequently do not add up, so re-derive figures rather than
copying them.

**The Budget Personnel dashboard** (`app/personnel/dashboard-content.tsx`) is the first module
reading the RAAO ledger: `public.departments` / `appropriations` / `allotments` / `obligations` /
`liquidations` / `anomaly_alerts`, added in
`supabase/migrations/20260812140000_raao_records.sql`. Its four KPI figures and both charts come
from three `security_invoker` **views** (`budget_summary`, `budget_by_department`,
`budget_by_fund`) scoped to the fiscal year marked `active` — PostgREST cannot `GROUP BY`, and a
view without `security_invoker` would run as its owner and bypass RLS. Read helpers live in
`app/lib/budget/dashboard.ts`, peso formatting in `app/lib/budget/format.ts`.
`20260812150000_raao_sample_data.sql` is demo data in its own migration so production can drop
that one file; unlike the mock it reconciles (per-department and per-fund breakdowns both total
the ₱22.45M headline, and no department is obligated past its release).

**One fiscal year is active at a time** (`public.fiscal_years`, partial unique index
`fiscal_years_one_active`), and `getActiveFiscalYear()` in `app/lib/config/fiscal-years.ts` is the
only entry point — it and `getFiscalYears()` are wrapped in React `cache()` for the same reason
`getSecuritySettings()` is. Never derive a fiscal year from the clock: the footer used to print
`new Date().getFullYear()` and sat under a dashboard showing the real one. Scoped to the active
year: Dashboard and Budget Monitoring (via the three views), RAAO Records, and Report Generation's
Fiscal Year filter, which defaults to it and offers "All fiscal years". Deliberately **not** scoped:
Archives, which exists to search closed years, and AI Anomaly Alerts, since `anomaly_alerts` has no
`fiscal_year_id`. `liquidations` has no such column either and reaches its year through the parent
obligation, so `listRecords` filters that tab with an `obligations!inner` join.

Anything rendered inside a `.print-area` follows the paper rules in `app/components/ui/paper.tsx`:
bare grouped figures, **no `₱` in a table cell**, a plain hyphen for nil. `formatPeso` is for
on-screen chrome; `formatAmount` is for paper. That applies to the report tables too — they print
on the same surface.

Charts are **recharts** in client components under `app/components/charts/`. Colours come from
`app/components/charts/palette.ts`, not the UI navy — the interface palette's three blues are
indistinguishable to a colour-blind reader, which is fine for chrome and wrong for encoding
identity. Those slots are validated (all-pairs CVD ΔE 9.2, normal-vision 24.0); if you add a
series, take the next slot in order rather than inventing a hue, and re-run the validator.

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

**Every setting on `/admin/security` is enforced, not just stored.** The header comment in
`supabase/migrations/20260806130000_security_settings.sql` claiming 2FA and the encryption
standard "have no real backend today" is out of date — it is left alone only because editing an
applied migration invites checksum drift. Where each one bites:

- *Two-Factor Authentication* — GoTrue's own TOTP factors (`app/lib/auth/mfa.ts`), so the secret
  lives in `auth.mfa_factors` and rides along in a dump. Needs `enroll_enabled`/`verify_enabled`
  under `[auth.mfa.totp]` in `supabase/config.toml`, which only takes effect after
  `supabase stop && supabase start`. `loginAction` parks the password step's **aal1** token in
  short-lived `raao_pending_*` cookies and only `verifyOtpAction` turns it into a session;
  `verifySession()` (`app/lib/auth/dal.ts`) rejects an aal1 token whenever the setting is on, so
  moving the pending cookie into `raao_at` gets nobody anywhere. Users self-enrol at
  `/login/verify`; an admin clears a lost device from `/admin/users`.
- *Password Expiry* — `public.user_password_state` (service-role only, `login_attempts` shape)
  records when each password was last set; `markPasswordChanged` is called from every place a
  password is written. `verifySession()` sends an expired or admin-issued password to
  `/change-password`, which is why that page and its action use `verifyIdentity()` instead — the
  full gate would bounce the user off the one screen that clears it.
- *Encryption Standard* — picks the AES-GCM cipher `app/lib/backup/crypto.ts` seals dump files
  with; see the Backup & Recovery notes below.

`getSecuritySettings()` is wrapped in React `cache()` because those gates read it on every
request alongside the layouts — it is a per-request memo, the fetch itself stays `no-store`.

**Backup & Recovery** (`app/admin/backup/`, `app/lib/backup/`) is the one module that does not go
through PostgREST for its real work: `app/lib/backup/pg.ts` spawns `pg_dump -Fc` / `pg_restore`
against `DATABASE_URL` so a dump covers the `auth` schema (GoTrue accounts and password hashes)
and `storage`, neither of which the Data API can reach. **The PostgreSQL client tools must be on
the server's PATH, at a major version >= the server's** (`pg_dump` refuses to dump a newer server;
a newer client is fine). The Dockerfile installs `postgresql17-client` to match
`supabase/config.toml`'s `major_version = 17` exactly. For local `npm run dev` install them
yourself — on Ubuntu 26.04 the archive only carries 18, which works against the 17.6 server:

```bash
sudo apt install postgresql-client-18
```

Without them the module still loads and records a `failed` row naming the missing binary. One
caveat if you ever mix versions: a custom-format archive written by pg_dump 18 cannot be read by
pg_restore 17, so a dump taken locally is not restorable inside the 17-client app container. The
version guard in `restoreBackup()` compares *server* versions and will not catch that.

**`DATABASE_URL` must connect as `supabase_admin`, not `postgres`.** A Supabase dump carries
`ALTER ... OWNER TO supabase_auth_admin` / `supabase_storage_admin` and
`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`. `postgres` is not a member of those roles, so
restoring as it fails 73 statements ("must be able to SET ROLE", "permission denied to change
default privileges") — table data still lands, which makes the half-restore easy to miss. As
`supabase_admin` (a superuser) `pg_restore` exits 0 with no errors.

Its two bookkeeping tables live in a **`raao_ops` schema, not `public`** — `pg_dump` emits a
literal `DROP SCHEMA IF EXISTS public` for an explicitly selected schema, so a restore would
otherwise erase the backup history along with everything else. `raao_ops` is listed in `schemas`
under `[api]` in `supabase/config.toml`, and because more than one schema is exposed, PostgREST
needs an `Accept-Profile` (read) / `Content-Profile` (write) header to route there — see
`app/lib/backup/backups.ts`. Automated backups come from `POST /api/backup/run`, guarded by
`BACKUP_CRON_SECRET` and driven by the host's crontab; Next.js has no scheduler of its own.

**Dumps are encrypted at rest when `BACKUP_ENCRYPTION_KEY` is set** — `app/lib/backup/crypto.ts`
streams the `pg_dump` output through AES-256-GCM or AES-128-GCM, whichever the Encryption Standard
setting names, into a file headed by the magic `RAAOBK1`. `pg_dump` cannot encrypt, so an
encrypted backup is dumped to a `.tmp` first and sealed on the way to its final name; restore and
download decrypt to a scratch file that is always removed. `raao_ops.backups.encryption` records
what each file actually is, so dumps taken before this existed (`none`) and dumps taken under the
other cipher both stay restorable. There is only one key and it is stored nowhere: rotating
`BACKUP_ENCRYPTION_KEY` makes every existing encrypted dump unrestorable. Unset it and backups
are plaintext, which `/admin/security` says out loud.

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
