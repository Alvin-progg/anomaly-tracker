import "server-only";
import { authEnv } from "@/app/lib/auth/env";

/** Read layer for the Budget Monitoring Overview — fund-grain figures from the extended
 * budget_by_fund view (supabase/migrations/20260812170000_budget_monitoring_views.sql). Same
 * bearer-token, fail-soft pattern as app/lib/budget/dashboard.ts. */

export interface FundMonitoring {
  fund: string;
  shortCode: string;
  appropriated: number;
  allotted: number;
  obligated: number;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { apikey: authEnv.anonKey, Authorization: `Bearer ${accessToken}` };
}

const num = (value: unknown): number => Number(value ?? 0);

export async function getFundMonitoring(accessToken: string): Promise<FundMonitoring[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/budget_by_fund?select=*&order=appropriated.desc`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return [];

    const rows = (await response.json()) as {
      fund: string;
      short_code: string;
      appropriated: number | string;
      allotted: number | string;
      obligated: number | string;
    }[];

    return rows.map((row) => ({
      fund: row.fund,
      shortCode: row.short_code,
      appropriated: num(row.appropriated),
      allotted: num(row.allotted),
      obligated: num(row.obligated),
    }));
  } catch {
    return [];
  }
}
