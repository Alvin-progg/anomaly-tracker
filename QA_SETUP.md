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
```

Leave `COOKIE_SECURE=false` for local HTTP testing, and `SESSION_IDLE_TIMEOUT_MINUTES` at its
default unless you're specifically testing idle-timeout behavior. No JWT secret is needed — the
app verifies session tokens against GoTrue's JWKS endpoint, not a shared secret.

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
