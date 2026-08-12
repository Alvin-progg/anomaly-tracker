import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");

export const authEnv = {
  supabaseUrl,
  // Kong gateway auth route. Every GoTrue endpoint is reached through here, not directly.
  authUrl: `${supabaseUrl}/auth/v1`,
  // Kong gateway PostgREST route, for the app's own `public` schema tables.
  restUrl: `${supabaseUrl}/rest/v1`,
  // Kong gateway Storage route, used by app/lib/raao/attachments.ts for ORS supporting documents.
  storageUrl: `${supabaseUrl}/storage/v1`,
  anonKey: required("SUPABASE_ANON_KEY"),
  // Bypasses RLS; grants GoTrue admin API access. Never exposed to the browser. Optional at
  // module load (unlike the vars above) so a missing key only breaks User Account Management,
  // not the whole app — app/lib/auth/admin.ts throws when it's actually needed and absent.
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  cookieSecure: process.env.COOKIE_SECURE === "true",
  idleTimeoutMinutes: Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? "15"),
  // Direct Postgres connection used only by app/lib/backup/pg.ts (pg_dump/pg_restore). Optional
  // at module load, same reasoning as serviceRoleKey above: a missing value should break the
  // Backup & Recovery module alone, not every route in the app.
  databaseUrl: process.env.DATABASE_URL,
  backupDir: process.env.BACKUP_DIR ?? "backups",
  // Passphrase for encrypting dump files at rest (app/lib/backup/crypto.ts), which is what the
  // Encryption Standard setting in /admin/security selects the cipher for. Optional, same
  // reasoning as the two above: unset means dumps stay in plaintext and the Security Policies
  // page says so, rather than the Backup module refusing to run. Rotating it makes existing
  // encrypted dumps unreadable — each backup row records the cipher it was written with, but
  // there is only ever one key.
  backupEncryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  // Unset disables app/api/backup/run — automated backups are opt-in.
  backupCronSecret: process.env.BACKUP_CRON_SECRET,
};
