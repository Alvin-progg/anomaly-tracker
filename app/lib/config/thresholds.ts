import "server-only";
import { authEnv } from "@/app/lib/auth/env";
import type { ThresholdModule, ThresholdType } from "./threshold-types";

export interface FinancialThreshold {
  id: string;
  name: string;
  module: ThresholdModule;
  type: ThresholdType;
  value: string;
}

interface FinancialThresholdRow {
  id: string;
  name: string;
  module: ThresholdModule;
  threshold_type: ThresholdType;
  value: string;
}

function fromRow(row: FinancialThresholdRow): FinancialThreshold {
  return { id: row.id, name: row.name, module: row.module, type: row.threshold_type, value: row.value };
}

export async function getFinancialThresholds(): Promise<FinancialThreshold[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/financial_thresholds?select=*&order=name.asc`, {
      headers: { apikey: authEnv.anonKey },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as FinancialThresholdRow[];
    return rows.map(fromRow);
  } catch {
    return [];
  }
}

export async function createFinancialThreshold(
  accessToken: string,
  data: { name: string; module: ThresholdModule; type: ThresholdType; value: string }
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/financial_thresholds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: data.name, module: data.module, threshold_type: data.type, value: data.value }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.message ?? "Failed to create threshold." };
    }
    return {};
  } catch {
    return { error: "Failed to create threshold." };
  }
}

export async function updateFinancialThreshold(
  accessToken: string,
  id: string,
  data: { name: string; module: ThresholdModule; type: ThresholdType; value: string }
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/financial_thresholds?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: data.name,
        module: data.module,
        threshold_type: data.type,
        value: data.value,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.message ?? "Failed to update threshold." };
    }
    return {};
  } catch {
    return { error: "Failed to update threshold." };
  }
}
