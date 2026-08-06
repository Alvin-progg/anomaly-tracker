import "server-only";
import { authEnv } from "@/app/lib/auth/env";

export interface FiscalYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "active" | "closed";
}

interface FiscalYearRow {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: "active" | "closed";
}

function fromRow(row: FiscalYearRow): FiscalYear {
  return { id: row.id, label: row.label, startDate: row.start_date, endDate: row.end_date, status: row.status };
}

export async function getFiscalYears(): Promise<FiscalYear[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/fiscal_years?select=*&order=start_date.desc`, {
      headers: { apikey: authEnv.anonKey },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as FiscalYearRow[];
    return rows.map(fromRow);
  } catch {
    return [];
  }
}

export async function createFiscalYear(
  accessToken: string,
  data: { label: string; startDate: string; endDate: string }
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/fiscal_years`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ label: data.label, start_date: data.startDate, end_date: data.endDate }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.message ?? "Failed to create fiscal year." };
    }
    return {};
  } catch {
    return { error: "Failed to create fiscal year." };
  }
}

/**
 * Two sequential PATCHes, not a transaction: close whichever row is currently active, then
 * activate the target. Admin-only, low-frequency writes, so the brief window where no row (or
 * neither/both) is active between the two requests is an accepted trade-off — see the
 * migration's header comment on `fiscal_years_one_active`.
 */
export async function activateFiscalYear(accessToken: string, id: string): Promise<{ error?: string }> {
  const headers = {
    "Content-Type": "application/json",
    apikey: authEnv.anonKey,
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const closeCurrent = await fetch(`${authEnv.restUrl}/fiscal_years?status=eq.active`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "closed" }),
      cache: "no-store",
    });
    if (!closeCurrent.ok) {
      const body = await closeCurrent.json().catch(() => null);
      return { error: body?.message ?? "Failed to close current fiscal year." };
    }

    const activateTarget = await fetch(`${authEnv.restUrl}/fiscal_years?id=eq.${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "active" }),
      cache: "no-store",
    });
    if (!activateTarget.ok) {
      const body = await activateTarget.json().catch(() => null);
      return { error: body?.message ?? "Failed to activate fiscal year." };
    }
    return {};
  } catch {
    return { error: "Failed to activate fiscal year." };
  }
}
