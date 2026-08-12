# QA Environment Setup

This guide gets the app running locally for manual testing: Next.js dev server + the full
Supabase stack (Postgres, GoTrue auth, Studio) via the Supabase CLI.

## Prerequisites

- **Node.js** (v20+) and **npm**
- **Docker Engine**, reachable from wherever you run the `supabase` CLI. The CLI shells out to
  Docker to run Postgres/GoTrue/Studio as containers — without a running Docker daemon,
  `supabase start` fails immediately.
  - On Windows, running the CLI from **inside WSL2** with Docker Engine installed *inside* the
    WSL distro (not Docker Desktop for Windows) is the supported path for this project. Confirm
    it works with `docker ps` before continuing.
- **Supabase CLI** (`supabase --version` — this guide assumes v2.111.0+)

### Installing the prerequisites (Windows, from a bare machine)

Skip this section if Docker/WSL2/Node/Supabase CLI are already set up. All commands below run
**inside the WSL2 Ubuntu distro** unless noted otherwise.

1. **WSL2 + Ubuntu** — in PowerShell (as Administrator):
   ```powershell
   wsl --install -d Ubuntu
   ```
   Reboot if prompted, then open the Ubuntu app from the Start menu once to finish setup
   (create a Unix username/password).

2. **Docker Engine inside WSL** — in the Ubuntu terminal:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
   Close and reopen the WSL terminal (group membership needs a fresh shell), then confirm with
   `docker ps` (should print an empty table, not a connection error). Docker doesn't start
   automatically on WSL boot — if `docker ps` fails, run `sudo service docker start` first.

3. **Node.js** — in the Ubuntu terminal:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Supabase CLI** — in the Ubuntu terminal, download the `.deb` package from the
   [supabase/cli releases page](https://github.com/supabase/cli/releases/latest) (pick the
   `linux_amd64.deb` asset) and install it:
   ```bash
   curl -Lo supabase.deb https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb
   sudo dpkg -i supabase.deb
   rm supabase.deb
   ```
   Confirm with `supabase --version`. (The CLI is deliberately not installable via
   `npm install -g supabase` — Supabase blocks that path; use the release asset above instead.)

With all four in place, continue at [Clone and install](#1-clone-and-install) below.

## 1. Clone and install

```bash
git clone <repo-url>
cd raao
npm install
```

## 2. Start the Supabase stack

```bash
supabase start
```

First run pulls several Docker images and can take a few minutes. When it finishes, it prints a
table of URLs and keys — you'll need the **API URL** and **Publishable key** in the next step.
Re-run `supabase status` any time to see this table again.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<Publishable key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
```

Leave `COOKIE_SECURE=false` for local HTTP testing, and `SESSION_IDLE_TIMEOUT_MINUTES` at its
default unless you're specifically testing idle-timeout behavior. No JWT secret is needed — the
app verifies session tokens against GoTrue's JWKS endpoint, not a shared secret.

`SUPABASE_SERVICE_ROLE_KEY` is optional for most manual testing, but required for: User Account
Management (`/admin/users`), Backup & Recovery, and the automated Delayed Liquidation scan (see
[Testing AI Anomaly Alerts](#testing-ai-anomaly-alerts) below). Without it those features degrade
gracefully (a clear error/disabled state) rather than crashing the app.

Everything else in `.env.example` is optional and feature-specific — each var has its own comment
explaining what it unlocks and what happens if it's left unset. Two worth knowing about for QA:

- `GROQ_API_KEY` — enables the "Get AI Explanation" button on `/personnel/alerts`. Get a free key
  at [console.groq.com/keys](https://console.groq.com/keys). Unset = the button shows a friendly
  "not configured" message instead of erroring.
- `ALERTS_SCAN_SECRET` — required to test the Delayed Liquidation detection rule; see below.

## 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test accounts

Seeded automatically by `supabase/seed.sql` on `supabase start` / `supabase db reset`. Log in
with the **username** (not the full email) on the login form:

| Username     | Password       | Role       | Lands on     |
|--------------|----------------|------------|--------------|
| `admin`      | `ChangeMe123!` | admin      | `/admin`     |
| `personnel`  | `ChangeMe123!` | personnel  | `/personnel` |

Public signup is disabled — these are the only accounts available in a fresh environment.

## Testing AI Anomaly Alerts

`/personnel/alerts` reviews anomalies flagged against RAAO obligations. Five of the six detection
rules run automatically the moment an obligation is created (`/personnel/raao` → Obligations →
New Entry) — no setup needed to see them fire:

| Rule | Fires when |
|---|---|
| Expenditure Spike | Amount ≥150% above the department's 30-day average obligation amount |
| Duplicate Entry Detected | Same department, payee, amount, and description as another obligation within 7 days |
| Structuring | 3+ obligations for the same department within 30 days, each sitting at 90–99.99% of the ₱500,000 approval threshold |
| Missing Supporting Document | No file attached to the obligation |
| Obligation Exceeds Allotment | Only fires once an obligation is linked to an allotment — the current New Obligation form doesn't expose an allotment picker, so this one can't be triggered through the UI yet |

If any rule fires, the obligation form shows a banner naming the alert ref(s) (e.g. "Flagged 2
potential anomaly alerts for review: AID-2026-0012, AID-2026-0013").

**Delayed Liquidation** is different — it depends on time passing (an obligation outstanding
>30 days with no liquidation recorded), so it can't fire at creation time. It runs on a schedule
instead, triggered by `POST /api/alerts/scan-delayed-liquidations`. To test it manually:

1. Set `ALERTS_SCAN_SECRET` in `.env.local` to any value and restart `npm run dev`.
2. Create an obligation dated more than 30 days ago with no liquidation against it (or just use
   the seed data — several sample obligations already qualify).
3. Trigger the scan:
   ```bash
   curl -X POST -H "x-alerts-scan-secret: <your value>" \
     http://localhost:3000/api/alerts/scan-delayed-liquidations
   ```
   Response is `{"created": N}`. Re-running it should return `{"created": 0}` — the scan skips
   obligations it's already flagged.

## Useful local URLs

| What              | URL                             |
|-------------------|----------------------------------|
| App               | http://localhost:3000           |
| Supabase Studio   | http://127.0.0.1:54323          |
| Mailpit (test email) | http://127.0.0.1:54324       |

## Resetting to a clean state

```bash
supabase db reset
```

Wipes local data and re-runs migrations + `seed.sql`, restoring both test accounts to their
default password. Useful if test data gets into a bad state.

## Stopping

```bash
supabase stop
```

Stops the Docker containers; data persists in a Docker volume for next time. Use
`supabase stop --no-backup` only if you intentionally want to discard local data.

## Troubleshooting

**`supabase start` / `supabase status` fails to connect to Docker** — Docker daemon isn't
reachable from the shell you're running the CLI in. If you're on Windows using WSL2 + Docker
Engine, make sure you're running `supabase` from *inside* the WSL distro, not from a Windows
terminal (PowerShell/cmd/Git Bash) — those talk to Docker Desktop's named pipe, which is a
different daemon than the one inside WSL.

**Login fails / "Invalid username or password" for the seeded accounts** — run
`supabase status` and confirm the container health is all green, then confirm `.env.local`'s
`SUPABASE_URL` and `SUPABASE_ANON_KEY` match what `supabase status` currently prints (these
regenerate if you ever wipe and reinitialize the project).

**Permission errors editing files under WSL** — if the repo was ever touched by a process
running as root inside WSL (e.g. a root-owned Docker bind mount), files can end up owned by
`root` instead of your user, blocking edits from your own shell or editor. Fix with:
```bash
sudo chown -R $USER:$USER /path/to/raao
```
