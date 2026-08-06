import "server-only";
import { authEnv } from "@/app/lib/auth/env";

export interface FundClassification {
  id: string;
  name: string;
  shortCode: string;
  active: boolean;
}

interface FundClassificationRow {
  id: string;
  name: string;
  short_code: string;
  active: boolean;
}

function fromRow(row: FundClassificationRow): FundClassification {
  return { id: row.id, name: row.name, shortCode: row.short_code, active: row.active };
}

export async function getFundClassifications(): Promise<FundClassification[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/fund_classifications?select=*&order=name.asc`, {
      headers: { apikey: authEnv.anonKey },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as FundClassificationRow[];
    return rows.map(fromRow);
  } catch {
    return [];
  }
}

export async function createFundClassification(
  accessToken: string,
  data: { name: string; shortCode: string }
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/fund_classifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: data.name, short_code: data.shortCode }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.message ?? "Failed to create fund classification." };
    }
    return {};
  } catch {
    return { error: "Failed to create fund classification." };
  }
}

export async function updateFundClassification(
  accessToken: string,
  id: string,
  data: { name: string; shortCode: string }
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/fund_classifications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: data.name, short_code: data.shortCode }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.message ?? "Failed to update fund classification." };
    }
    return {};
  } catch {
    return { error: "Failed to update fund classification." };
  }
}

export async function setFundClassificationActive(
  accessToken: string,
  id: string,
  active: boolean
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/fund_classifications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ active }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.message ?? "Failed to update fund classification status." };
    }
    return {};
  } catch {
    return { error: "Failed to update fund classification status." };
  }
}
