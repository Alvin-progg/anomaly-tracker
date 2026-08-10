import "server-only";
import { authEnv } from "@/app/lib/auth/env";

/**
 * Read layer for the Backup & Recovery module. RLS on both tables is admin-gated (see
 * supabase/migrations/20260810120000_backup_recovery.sql), so these use the bearer-token style of
 * app/lib/tracking/tracking.ts rather than the anon-key style of app/lib/config/*. Writes live in
 * app/lib/backup/pg.ts and go through the service role instead, because the cron path has no JWT.
 *
 * Both tables live in the `raao_ops` schema, not `public`, so a restore cannot erase the backup
 * history. PostgREST only routes to a non-default exposed schema when asked, hence the
 * `Accept-Profile` header on every read here (writes use `Content-Profile`).
 */

/** Schema holding backup bookkeeping — see `schemas` under `[api]` in supabase/config.toml. */
export const BACKUP_SCHEMA = "raao_ops";

export interface BackupSettings {
  scheduleLabel: string;
  scheduleCron: string;
  retentionDays: number;
  storagePath: string;
}

export type BackupType = "manual" | "automated" | "safety";
export type BackupStatus = "running" | "success" | "failed";

export interface BackupRecord {
  id: string;
  backupRef: string;
  fileName: string;
  sizeBytes: number;
  checksum: string | null;
  type: BackupType;
  status: BackupStatus;
  pgVersion: string | null;
  error: string | null;
  triggeredBy: string;
  createdAt: string;
  completedAt: string | null;
}

/** Also rendered directly when there is no access token to read the real row with. */
export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  scheduleLabel: "Daily at 2:00 AM",
  scheduleCron: "0 2 * * *",
  retentionDays: 30,
  storagePath: authEnv.backupDir,
};

interface BackupSettingsRow {
  schedule_label: string;
  schedule_cron: string;
  retention_days: number;
  storage_path: string;
}

interface BackupRow {
  id: string;
  backup_ref: string;
  file_name: string;
  size_bytes: number;
  checksum: string | null;
  type: BackupType;
  status: BackupStatus;
  pg_version: string | null;
  error: string | null;
  triggered_by: string;
  created_at: string;
  completed_at: string | null;
}

function settingsFromRow(row: BackupSettingsRow): BackupSettings {
  return {
    scheduleLabel: row.schedule_label,
    scheduleCron: row.schedule_cron,
    retentionDays: row.retention_days,
    storagePath: row.storage_path,
  };
}

function backupFromRow(row: BackupRow): BackupRecord {
  return {
    id: row.id,
    backupRef: row.backup_ref,
    fileName: row.file_name,
    // PostgREST returns bigint as a JSON number here; coerce defensively in case it ever changes.
    sizeBytes: Number(row.size_bytes),
    checksum: row.checksum,
    type: row.type,
    status: row.status,
    pgVersion: row.pg_version,
    error: row.error,
    triggeredBy: row.triggered_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: authEnv.anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Accept-Profile": BACKUP_SCHEMA,
  };
}

export async function getBackupSettings(accessToken: string): Promise<BackupSettings> {
  try {
    const response = await fetch(`${authEnv.restUrl}/backup_settings?select=*&id=eq.1`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_BACKUP_SETTINGS;

    const rows = (await response.json()) as BackupSettingsRow[];
    return rows[0] ? settingsFromRow(rows[0]) : DEFAULT_BACKUP_SETTINGS;
  } catch {
    return DEFAULT_BACKUP_SETTINGS;
  }
}

export async function listBackups(accessToken: string, limit = 50): Promise<BackupRecord[]> {
  try {
    const response = await fetch(
      `${authEnv.restUrl}/backups?select=*&order=created_at.desc&limit=${limit}`,
      { headers: authHeaders(accessToken), cache: "no-store" }
    );
    if (!response.ok) return [];

    const rows = (await response.json()) as BackupRow[];
    return rows.map(backupFromRow);
  } catch {
    return [];
  }
}

export async function getBackupByRef(accessToken: string, ref: string): Promise<BackupRecord | null> {
  try {
    const response = await fetch(
      `${authEnv.restUrl}/backups?select=*&backup_ref=eq.${encodeURIComponent(ref)}&limit=1`,
      { headers: authHeaders(accessToken), cache: "no-store" }
    );
    if (!response.ok) return null;

    const rows = (await response.json()) as BackupRow[];
    return rows[0] ? backupFromRow(rows[0]) : null;
  } catch {
    return null;
  }
}
