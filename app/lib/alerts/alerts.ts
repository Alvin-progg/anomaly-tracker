import "server-only";
import { authEnv } from "@/app/lib/auth/env";
import type { AnomalyAlert } from "@/app/lib/budget/dashboard";

/**
 * Read/write layer for the AI Anomaly Alert Review module (/personnel/alerts) — the review
 * counterpart to app/lib/budget/dashboard.ts's read-only pending-preview. Split out the same way
 * app/lib/raao/records.ts was split from dashboard.ts: a different page, different read/write
 * needs, no reason to grow the dashboard's aggregate-only file.
 */

export type AlertStatus = "Pending" | "Valid Anomaly" | "False Positive" | "Needs Further Verification";

function authHeaders(accessToken: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: authEnv.anonKey, Authorization: `Bearer ${accessToken}`, ...extra };
}

interface AlertRow {
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
}

function fromRow(row: AlertRow): AnomalyAlert {
  return {
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
  };
}

const SELECT = "select=*,departments(name)";

/** Every alert, newest first — the full review list, unlike getPendingAlerts's Pending-only feed. */
export async function listAlerts(accessToken: string): Promise<AnomalyAlert[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/anomaly_alerts?${SELECT}&order=detected_at.desc`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as AlertRow[];
    return rows.map(fromRow);
  } catch {
    return [];
  }
}

export async function getAlertById(accessToken: string, id: string): Promise<AnomalyAlert | null> {
  try {
    const response = await fetch(`${authEnv.restUrl}/anomaly_alerts?${SELECT}&id=eq.${id}&limit=1`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as AlertRow[];
    return rows[0] ? fromRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function updateAlertStatus(accessToken: string, id: string, status: AlertStatus): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/anomaly_alerts?id=eq.${id}`, {
      method: "PATCH",
      headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
      cache: "no-store",
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return { error: errorBody?.message ?? "Failed to update alert status." };
    }
    return {};
  } catch {
    return { error: "Failed to update alert status." };
  }
}

/**
 * Runs the Expenditure Spike check (public.detect_expenditure_spike) for a just-created
 * obligation — best-effort, called from createObligationAction. Returns the inserted alert if
 * the obligation's amount was >=150% above its department's trailing-30-day average, else null.
 */
export async function detectExpenditureSpike(accessToken: string, obligationId: string): Promise<AnomalyAlert | null> {
  try {
    const response = await fetch(`${authEnv.restUrl}/rpc/detect_expenditure_spike`, {
      method: "POST",
      headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ p_obligation_id: obligationId }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as AlertRow[];
    return rows[0] ? fromRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export interface ObligationContext {
  amount: number;
  payee: string | null;
  recordDate: string;
}

/** Looks up the obligation an alert's record_ref points to, for richer Groq prompt context. */
export async function getObligationContext(accessToken: string, ref: string): Promise<ObligationContext | null> {
  try {
    const response = await fetch(`${authEnv.restUrl}/obligations?select=amount,payee,record_date&ref=eq.${ref}&limit=1`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as { amount: number | string; payee: string | null; record_date: string }[];
    const row = rows[0];
    return row ? { amount: Number(row.amount), payee: row.payee, recordDate: row.record_date } : null;
  } catch {
    return null;
  }
}
