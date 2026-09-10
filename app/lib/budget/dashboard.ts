import "server-only";
import { authEnv } from "@/app/lib/auth/env";

/**
 * Read layer for the Budget Personnel dashboard. Bearer-token style like
 * app/lib/backup/backups.ts (the RAAO tables are readable by signed-in staff only, never anon),
 * against the aggregate views in supabase/migrations/20260812140000_raao_records.sql — PostgREST
 * cannot GROUP BY, so the grouping lives in the database where the RLS still applies.
 *
 * Every function fails soft to an empty result: a dashboard panel that renders "no data" is a far
 * better outcome than a portal that will not load because one aggregate timed out.
 */

export interface BudgetSummary {
  fiscalYear: string;
  totalAppropriations: number;
  totalAllotments: number;
  totalObligations: number;
  /** Released but not yet obligated — the money still available to commit. */
  remainingBalance: number;
}

export interface DepartmentUtilization {
  department: string;
  shortCode: string;
  appropriated: number;
  obligated: number;
}

export interface FundShare {
  fund: string;
  shortCode: string;
  appropriated: number;
}

export interface AnomalyAlert {
  id: string;
  alertRef: string;
  alertType: string;
  recordRef: string;
  department: string | null;
  description: string;
  confidence: number;
  severity: "Low" | "Medium" | "High";
  status: string;
  detectedAt: string;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { apikey: authEnv.anonKey, Authorization: `Bearer ${accessToken}` };
}

async function query<T>(accessToken: string, path: string): Promise<T[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/${path}`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

// PostgREST serialises `numeric` as a JSON number, but a bigint-sized total can come back as a
// string — coerce defensively, same as backupFromRow does for size_bytes.
const num = (value: unknown): number => Number(value ?? 0);

export async function getBudgetSummary(accessToken: string): Promise<BudgetSummary | null> {
  const rows = await query<{
    fiscal_year: string;
    total_appropriations: number | string;
    total_allotments: number | string;
    total_obligations: number | string;
  }>(accessToken, "budget_summary?select=*&limit=1");

  const row = rows[0];
  if (!row) return null;

  const totalAllotments = num(row.total_allotments);
  const totalObligations = num(row.total_obligations);

  return {
    fiscalYear: row.fiscal_year,
    totalAppropriations: num(row.total_appropriations),
    totalAllotments,
    totalObligations,
    remainingBalance: totalAllotments - totalObligations,
  };
}

export async function getDepartmentUtilization(accessToken: string): Promise<DepartmentUtilization[]> {
  const rows = await query<{
    department: string;
    short_code: string;
    appropriated: number | string;
    obligated: number | string;
  }>(accessToken, "budget_by_department?select=*&order=appropriated.desc");

  return rows.map((row) => ({
    department: row.department,
    shortCode: row.short_code,
    appropriated: num(row.appropriated),
    obligated: num(row.obligated),
  }));
}

export async function getFundDistribution(accessToken: string): Promise<FundShare[]> {
  const rows = await query<{ fund: string; short_code: string; appropriated: number | string }>(
    accessToken,
    "budget_by_fund?select=*&order=appropriated.desc"
  );

  return rows
    .map((row) => ({ fund: row.fund, shortCode: row.short_code, appropriated: num(row.appropriated) }))
    .filter((row) => row.appropriated > 0);
}

/** Newest unreviewed alerts — what the dashboard panel shows and the badge counts. */
export async function getPendingAlerts(
  accessToken: string,
  limit: number
): Promise<{ alerts: AnomalyAlert[]; pendingCount: number }> {
  const [rows, pendingCount] = await Promise.all([
    query<{
      id: string;
      alert_ref: string;
      alert_type: string;
      record_ref: string;
      description: string;
      confidence: number;
      severity: AnomalyAlert["severity"];
      status: string;
      detected_at: string;
      departments: { name: string } | null;
    }>(
      accessToken,
      `anomaly_alerts?select=*,departments(name)&status=eq.Pending&order=detected_at.desc&limit=${limit}`
    ),
    countPendingAlerts(accessToken),
  ]);

  const alerts = rows.map((row) => ({
    id: row.id,
    alertRef: row.alert_ref,
    alertType: row.alert_type,
    recordRef: row.record_ref,
    department: row.departments?.name ?? null,
    description: row.description,
    confidence: row.confidence,
    severity: row.severity,
    status: row.status,
    detectedAt: row.detected_at,
  }));

  return { alerts, pendingCount };
}

/**
 * The badge must count every pending alert, not the three on screen, so it uses PostgREST's exact
 * count header rather than the length of the list above.
 */
async function countPendingAlerts(accessToken: string): Promise<number> {
  try {
    const response = await fetch(`${authEnv.restUrl}/anomaly_alerts?select=id&status=eq.Pending`, {
      headers: { ...authHeaders(accessToken), Prefer: "count=exact", Range: "0-0" },
      cache: "no-store",
    });
    // Content-Range comes back as "0-0/12"; the total is what matters.
    const total = response.headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : 0;
  } catch {
    return 0;
  }
}
