import "server-only";
import { unstable_cache } from "next/cache";
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

/**
 * Global, anon-key-only config data (no bearer token, not RLS-scoped per user), so it's safe
 * behind `unstable_cache` — invalidated by `updateTag("fund-classifications")` from the
 * create/update/toggle-active actions in app/admin/config/actions.ts.
 */
export const getFundClassifications = unstable_cache(
  async (): Promise<FundClassification[]> => {
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
  },
  ["fund-classifications"],
  { tags: ["fund-classifications"] }
);

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
