import "server-only";
import { authEnv } from "@/app/lib/auth/env";

export interface UserSessionRow {
  id: string;
  user_id: string;
  email: string;
  role: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  email: string;
  role: string;
  module: string;
  action: string;
  details: string | null;
  created_at: string;
}

function authHeaders(accessToken: string, extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    apikey: authEnv.anonKey,
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

export async function recordSessionStart(params: {
  accessToken: string;
  userId: string;
  email: string;
  role: string;
  ipAddress: string;
  userAgent: string;
}): Promise<string | null> {
  try {
    const response = await fetch(`${authEnv.restUrl}/user_sessions`, {
      method: "POST",
      headers: authHeaders(params.accessToken, { Prefer: "return=representation" }),
      body: JSON.stringify({
        user_id: params.userId,
        email: params.email,
        role: params.role,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      }),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const rows = (await response.json()) as UserSessionRow[];
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function endSessionTracking(params: { accessToken: string; sessionId: string }): Promise<void> {
  try {
    await fetch(`${authEnv.restUrl}/user_sessions?id=eq.${params.sessionId}`, {
      method: "DELETE",
      headers: authHeaders(params.accessToken),
      cache: "no-store",
    });
  } catch {
    // Best-effort — a stale session row is harmless.
  }
}

export async function recordAuditEvent(params: {
  accessToken: string;
  userId: string;
  email: string;
  role: string;
  action: string;
  details?: string;
  /** Omit to fall back to the column default, 'Authentication'. */
  module?: string;
}): Promise<void> {
  try {
    await fetch(`${authEnv.restUrl}/audit_log`, {
      method: "POST",
      headers: authHeaders(params.accessToken),
      body: JSON.stringify({
        user_id: params.userId,
        email: params.email,
        role: params.role,
        module: params.module,
        action: params.action,
        details: params.details,
      }),
      cache: "no-store",
    });
  } catch {
    // Best-effort — a missed audit row must never block login/logout.
  }
}

/**
 * Audit entry for work with no user behind it — currently the cron-driven automated backup
 * (app/api/backup/run), which has no session and therefore no bearer token. Uses the service role,
 * which needs an explicit `grant insert on public.audit_log` (see the backup_recovery migration);
 * `user_id` is left null, which the audit_log FK allows.
 */
export async function recordSystemAuditEvent(params: {
  module: string;
  action: string;
  details?: string;
}): Promise<void> {
  const key = authEnv.serviceRoleKey;
  if (!key) return;

  try {
    await fetch(`${authEnv.restUrl}/audit_log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        user_id: null,
        email: "system",
        role: "system",
        module: params.module,
        action: params.action,
        details: params.details,
      }),
      cache: "no-store",
    });
  } catch {
    // Best-effort — a missed audit row must never fail the backup itself.
  }
}

export async function getActiveSessions(accessToken: string): Promise<UserSessionRow[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/user_sessions?select=*&order=created_at.desc`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()) as UserSessionRow[];
  } catch {
    return [];
  }
}

export async function getRecentActivity(accessToken: string, limit = 10): Promise<AuditLogRow[]> {
  try {
    const response = await fetch(
      `${authEnv.restUrl}/audit_log?select=*&order=created_at.desc&limit=${limit}`,
      { headers: authHeaders(accessToken), cache: "no-store" }
    );
    if (!response.ok) return [];
    return (await response.json()) as AuditLogRow[];
  } catch {
    return [];
  }
}
