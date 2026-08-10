import "server-only";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { authEnv } from "@/app/lib/auth/env";
import { BACKUP_SCHEMA, type BackupRecord, type BackupType } from "./backups";

/**
 * The actual backup engine: shells out to pg_dump / pg_restore rather than going through
 * PostgREST, so a dump is a genuine disaster-recovery artifact — the `auth` schema (GoTrue
 * accounts and password hashes) and `storage` are included, neither of which is reachable over
 * the Data API.
 *
 * Bookkeeping rows are written with the service-role key: the cron-driven POST /api/backup/run
 * has no session, and after a restore the acting admin's user row may not even exist any more.
 */

/** Schemas carried in every dump. `raao_ops` is deliberately absent — it must survive a restore. */
const DUMP_SCHEMAS = ["public", "auth", "storage"] as const;

const DUMP_TIMEOUT_MS = 10 * 60 * 1000;
const RESTORE_TIMEOUT_MS = 20 * 60 * 1000;

export type BackupOutcome =
  | { ok: true; ref: string; sizeBytes: number }
  | { ok: false; error: string };

export type RestoreOutcome =
  | { ok: true; restoredFrom: string; safetyRef: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Process plumbing
// ---------------------------------------------------------------------------

interface PgEnv {
  PGHOST: string;
  PGPORT: string;
  PGUSER: string;
  PGPASSWORD: string;
  PGDATABASE: string;
}

/**
 * The connection string is superuser-grade, so it is passed to the child as libpq environment
 * variables rather than in argv — argv is world-readable through `ps`.
 *
 * It must connect as `supabase_admin`, not `postgres`. A Supabase dump carries
 * `ALTER ... OWNER TO supabase_auth_admin/supabase_storage_admin` and
 * `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`; `postgres` is not a member of those roles,
 * so restoring as it fails 73 statements with "must be able to SET ROLE" / "permission denied to
 * change default privileges". Table data still lands, but schema ownership and default privileges
 * do not — a silently half-restored database. `supabase_admin` is a superuser and restores clean.
 */
function pgEnv(): PgEnv {
  if (!authEnv.databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  const url = new URL(authEnv.databaseUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username) || "postgres",
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1) || "postgres",
  };
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // Deliberately not `...process.env` — the child only needs PATH plus its libpq credentials.
    // (NODE_ENV is carried along only because Next's ProcessEnv augmentation makes it required.)
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH,
      ...pgEnv(),
    };
    const child = spawn(bin, args, { env, windowsHide: true });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          err.message.includes("ENOENT")
            ? `${bin} is not installed on the server. Install the PostgreSQL client tools.`
            : err.message
        )
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${bin} timed out after ${Math.round(timeoutMs / 60000)} minutes.`));
        return;
      }
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** Never surface a full pg log to the browser or an `error` column — one line is enough. */
function lastLine(stderr: string): string {
  const lines = stderr.trim().split("\n").filter(Boolean);
  return lines[lines.length - 1] ?? "unknown error";
}

/**
 * pg_restore exits non-zero whenever it logged *any* error, and `--clean --if-exists` legitimately
 * logs "does not exist" for objects that were not there to drop. So exit status alone cannot
 * decide the outcome.
 *
 * Only lines beginning `pg_restore: error:` are candidate failures. Classifying by message text
 * across all of stderr does not work: pg_restore echoes the offending statement as
 * `Command was: <sql>`, and a multi-statement block puts the remaining bare SQL on its own
 * continuation lines — which then look like unrecognised errors and get reported as the failure.
 */
const BENIGN_RESTORE_ERRORS = [/does not exist/i, /already exists/i];

function fatalRestoreErrors(stderr: string): string[] {
  return stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^pg_restore: error:/i.test(line))
    .filter((line) => !BENIGN_RESTORE_ERRORS.some((pattern) => pattern.test(line)));
}

/** Turn the two failure modes of a non-superuser DATABASE_URL into an actionable message. */
function withRoleHint(message: string): string {
  if (/must be able to SET ROLE|permission denied to change default privileges/i.test(message)) {
    return `${message} — DATABASE_URL must connect as a superuser (supabase_admin), not postgres.`;
  }
  return message;
}

async function serverVersion(): Promise<string> {
  const { code, stdout, stderr } = await run("psql", ["-tAX", "-c", "show server_version"], 30_000);
  if (code !== 0) throw new Error(lastLine(stderr));
  return stdout.trim();
}

function majorVersion(version: string): string {
  return version.split(".")[0] ?? version;
}

// ---------------------------------------------------------------------------
// Bookkeeping (service role, raao_ops schema)
// ---------------------------------------------------------------------------

function serviceHeaders(extra?: Record<string, string>): Record<string, string> {
  if (!authEnv.serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    "Content-Type": "application/json",
    apikey: authEnv.serviceRoleKey,
    Authorization: `Bearer ${authEnv.serviceRoleKey}`,
    "Accept-Profile": BACKUP_SCHEMA,
    "Content-Profile": BACKUP_SCHEMA,
    ...extra,
  };
}

async function insertBackupRow(row: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${authEnv.restUrl}/backups`, {
    method: "POST",
    headers: serviceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Failed to record the backup.");
  }
  const rows = (await response.json()) as { id: string }[];
  return rows[0].id;
}

async function patchBackupRow(id: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${authEnv.restUrl}/backups?id=eq.${id}`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify(patch),
    cache: "no-store",
  }).catch(() => {
    // Best-effort — losing the status update must not mask the underlying result.
  });
}

async function hasRunningBackup(): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - DUMP_TIMEOUT_MS).toISOString();
    const response = await fetch(
      `${authEnv.restUrl}/backups?select=id&status=eq.running&created_at=gt.${cutoff}&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" }
    );
    if (!response.ok) return false;
    return ((await response.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

async function getRetentionDays(): Promise<number> {
  try {
    const response = await fetch(`${authEnv.restUrl}/backup_settings?select=retention_days&id=eq.1`, {
      headers: serviceHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return 30;
    const rows = (await response.json()) as { retention_days: number }[];
    return rows[0]?.retention_days ?? 30;
  } catch {
    return 30;
  }
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function backupDir(): string {
  return path.resolve(authEnv.backupDir);
}

/** Always rebuild the path from the stored file name — never from user input. */
export function backupFilePath(fileName: string): string {
  return path.join(backupDir(), path.basename(fileName));
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(/*turbopackIgnore: true*/ filePath)).digest("hex");
}

function backupRef(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    "BKP",
    now.getFullYear(),
    `${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  ].join("-");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runBackup(params: {
  type: BackupType;
  triggeredBy: string;
}): Promise<BackupOutcome> {
  let rowId: string | null = null;
  let filePath: string | null = null;

  try {
    if (await hasRunningBackup()) {
      return { ok: false, error: "A backup is already running. Wait for it to finish." };
    }

    const ref = backupRef();
    const fileName = `${ref}.dump`;
    filePath = backupFilePath(fileName);
    await mkdir(/*turbopackIgnore: true*/ backupDir(), { recursive: true });

    rowId = await insertBackupRow({
      backup_ref: ref,
      file_name: fileName,
      type: params.type,
      status: "running",
      triggered_by: params.triggeredBy,
    });

    const version = await serverVersion();

    // -Fc is already compressed, so there is no gzip layer on top. The two bookkeeping tables are
    // in raao_ops and so are excluded simply by not naming that schema.
    const { code, stderr } = await run(
      "pg_dump",
      [
        "-Fc",
        "--no-password",
        ...DUMP_SCHEMAS.flatMap((schema) => ["-n", schema]),
        "-f",
        filePath,
      ],
      DUMP_TIMEOUT_MS
    );
    if (code !== 0) throw new Error(lastLine(stderr));

    const { size } = await stat(/*turbopackIgnore: true*/ filePath);
    const checksum = await sha256(filePath);

    await patchBackupRow(rowId, {
      size_bytes: size,
      checksum,
      pg_version: version,
      status: "success",
      completed_at: new Date().toISOString(),
    });

    await pruneOldBackups();

    return { ok: true, ref, sizeBytes: size };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed.";
    if (rowId) {
      await patchBackupRow(rowId, {
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      });
    }
    // A half-written dump is worse than none — it would pass a checksum it was never given.
    if (filePath) await rm(/*turbopackIgnore: true*/ filePath, { force: true }).catch(() => {});
    return { ok: false, error: message };
  }
}

/**
 * Replaces every object in the public, auth and storage schemas with the contents of the dump.
 * Destructive by design — all user accounts and the audit trail come from the dump, not from the
 * live database. Callers must treat the current session as dead afterwards.
 */
export async function restoreBackup(params: {
  backup: BackupRecord;
  triggeredBy: string;
}): Promise<RestoreOutcome> {
  const { backup } = params;

  try {
    if (backup.status !== "success") {
      return { ok: false, error: "Only a successful backup can be restored." };
    }

    const filePath = backupFilePath(backup.fileName);
    try {
      await stat(/*turbopackIgnore: true*/ filePath);
    } catch {
      return { ok: false, error: `Backup file ${backup.fileName} is missing from ${backupDir()}.` };
    }

    // Verify integrity and version compatibility BEFORE anything is dropped — a dump that fails
    // halfway leaves the database in a state no one asked for.
    if (backup.checksum && (await sha256(filePath)) !== backup.checksum) {
      return { ok: false, error: "Backup file is corrupted (checksum mismatch). Restore aborted." };
    }

    const liveVersion = await serverVersion();
    if (backup.pgVersion && majorVersion(backup.pgVersion) !== majorVersion(liveVersion)) {
      return {
        ok: false,
        error: `Backup was taken on PostgreSQL ${backup.pgVersion} but this server runs ${liveVersion}.`,
      };
    }

    const safety = await runBackup({ type: "safety", triggeredBy: params.triggeredBy });
    if (!safety.ok) {
      return { ok: false, error: `Safety backup failed, restore aborted: ${safety.error}` };
    }

    const { code, stderr } = await run(
      "pg_restore",
      ["--clean", "--if-exists", "--no-password", "-d", pgEnv().PGDATABASE, filePath],
      RESTORE_TIMEOUT_MS
    );
    if (code !== 0) {
      const fatal = fatalRestoreErrors(stderr);
      if (fatal.length > 0) {
        return { ok: false, error: withRoleHint(fatal[0]) };
      }
    }

    return { ok: true, restoredFrom: backup.backupRef, safetyRef: safety.ref };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Restore failed." };
  }
}

/**
 * Drops dumps past the retention window. Safety backups are exempt — they are the only way back
 * from a bad restore. Best-effort, same convention as endSessionTracking().
 */
export async function pruneOldBackups(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - (await getRetentionDays()) * 86_400_000).toISOString();
    const query = `select=id,file_name&type=neq.safety&created_at=lt.${cutoff}`;

    const response = await fetch(`${authEnv.restUrl}/backups?${query}`, {
      headers: serviceHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return;

    const rows = (await response.json()) as { id: string; file_name: string }[];
    if (rows.length === 0) return;

    for (const row of rows) {
      await rm(/*turbopackIgnore: true*/ backupFilePath(row.file_name), { force: true }).catch(() => {});
    }

    await fetch(`${authEnv.restUrl}/backups?type=neq.safety&created_at=lt.${cutoff}`, {
      method: "DELETE",
      headers: serviceHeaders(),
      cache: "no-store",
    });
  } catch {
    // Retention is housekeeping — never let it fail the backup that triggered it.
  }
}
