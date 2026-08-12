import "server-only";
import { authEnv } from "./env";

/**
 * Password age tracking, the missing half of the Password Expiry setting in /admin/security:
 * public.security_settings stores `password_expiry_days`, and this is what actually knows how old
 * a given account's password is.
 *
 * GoTrue has no column for this — auth.users.updated_at moves on any user edit (role change, ban,
 * email change), so it cannot stand in for "when was the password last set". Hence a table of our
 * own, written at every point a password is set: admin create, admin reset, and the user's own
 * change on /change-password.
 *
 * Same service-role, fail-open contract as login-attempts.ts: a missing service role key or a
 * network hiccup must never force a password change or block a login. The failure mode is a user
 * who keeps an expired password one more session, not a user locked out of their account.
 */

interface PasswordStateRow {
  user_id: string;
  password_changed_at: string;
  must_change: boolean;
}

export interface PasswordState {
  passwordChangedAt: string;
  mustChange: boolean;
}

function serviceHeaders(): Record<string, string> | null {
  if (!authEnv.serviceRoleKey) return null;
  const key = authEnv.serviceRoleKey;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

export async function getPasswordState(userId: string): Promise<PasswordState | null> {
  const headers = serviceHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(
      `${authEnv.restUrl}/user_password_state?select=*&user_id=eq.${encodeURIComponent(userId)}`,
      { headers, cache: "no-store" }
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as PasswordStateRow[];
    const row = rows[0];
    return row ? { passwordChangedAt: row.password_changed_at, mustChange: row.must_change } : null;
  } catch {
    return null;
  }
}

/**
 * `mustChange: true` is for a password someone else chose — an admin-issued temporary password
 * (the create-user modal literally labels the field "Temporary Password") or an admin reset.
 */
export async function markPasswordChanged(
  userId: string,
  options: { mustChange: boolean }
): Promise<void> {
  const headers = serviceHeaders();
  if (!headers) return;
  try {
    const now = new Date().toISOString();
    // PostgREST upsert, same idiom as recordFailedLoginAttempt.
    await fetch(`${authEnv.restUrl}/user_password_state?on_conflict=user_id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        password_changed_at: now,
        must_change: options.mustChange,
        updated_at: now,
      }),
      cache: "no-store",
    });
  } catch {
    // Best-effort.
  }
}

/**
 * Pure, no I/O — same shape as getPasswordPolicyError in app/lib/config/security.ts so the whole
 * password policy stays testable without a database.
 *
 * A missing row (state === null) means "unknown age", which is treated as current: this is the
 * fail-open path, and the migration backfills every existing account anyway.
 */
export function isPasswordChangeRequired(
  state: PasswordState | null,
  expiryDays: number,
  now = Date.now()
): boolean {
  if (!state) return false;
  if (state.mustChange) return true;
  if (!Number.isFinite(expiryDays) || expiryDays <= 0) return false;

  const changedAt = new Date(state.passwordChangedAt).getTime();
  if (Number.isNaN(changedAt)) return false;

  return now - changedAt > expiryDays * 86_400_000;
}
