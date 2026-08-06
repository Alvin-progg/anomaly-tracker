import "server-only";
import { authEnv } from "./env";

interface LoginAttemptRow {
  email: string;
  failed_count: number;
  locked_until: string | null;
}

function serviceHeaders(): Record<string, string> | null {
  if (!authEnv.serviceRoleKey) return null;
  const key = authEnv.serviceRoleKey;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

async function getRow(email: string, headers: Record<string, string>): Promise<LoginAttemptRow | null> {
  const response = await fetch(`${authEnv.restUrl}/login_attempts?select=*&email=eq.${encodeURIComponent(email)}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as LoginAttemptRow[];
  return rows[0] ?? null;
}

/**
 * All three functions below are fail-open/best-effort: a missing service role key or any
 * network/DB hiccup must never block a real login attempt or crash the login flow, same
 * principle as recordAuditEvent in app/lib/tracking/tracking.ts.
 */
export async function getLockoutRemainingMinutes(email: string): Promise<number | null> {
  const headers = serviceHeaders();
  if (!headers) return null;
  try {
    const row = await getRow(email, headers);
    if (!row?.locked_until) return null;
    const remainingMs = new Date(row.locked_until).getTime() - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 60000) : null;
  } catch {
    return null;
  }
}

export async function recordFailedLoginAttempt(
  email: string,
  maxAttempts: number,
  lockoutMinutes: number
): Promise<void> {
  const headers = serviceHeaders();
  if (!headers) return;
  try {
    const row = await getRow(email, headers);
    const nextCount = (row?.failed_count ?? 0) + 1;
    const lockedUntil =
      nextCount >= maxAttempts ? new Date(Date.now() + lockoutMinutes * 60000).toISOString() : null;

    await fetch(`${authEnv.restUrl}/login_attempts?on_conflict=email`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        email,
        failed_count: nextCount,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
  } catch {
    // Best-effort.
  }
}

export async function resetLoginAttempts(email: string): Promise<void> {
  const headers = serviceHeaders();
  if (!headers) return;
  try {
    await fetch(`${authEnv.restUrl}/login_attempts?email=eq.${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
  } catch {
    // Best-effort.
  }
}
