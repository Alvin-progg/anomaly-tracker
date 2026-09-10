import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { authEnv } from "@/app/lib/auth/env";
import { PERSONNEL_MODULES, isPersonnelModule, type PersonnelModule } from "./modules";

/**
 * Fails open per-module: a module missing from the response (row not migrated yet, fetch
 * error, etc.) defaults to enabled=true. Only an explicit `enabled: false` row disables a
 * module — a missing row must never silently lock personnel out. This is the one place in
 * the app where "fail safe" means "fail enabled"; everywhere else (RLS, admin checks) fails
 * closed.
 *
 * Global, anon-key-only config data (no bearer token, not RLS-scoped per user), so it's safe
 * behind `unstable_cache` — invalidated by `updateTag("module-permissions")` from
 * `updateModulePermissionAction` (Next 16 dropped the one-arg `revalidateTag`; `updateTag` is
 * its Server Action replacement for immediate, read-your-own-writes invalidation). Wrapped
 * again in React `cache()` so the several call sites in one request (personnel layout's
 * sidebar, a page's own module gate) collapse to one call.
 */
const fetchPersonnelPermissions = unstable_cache(
  async (): Promise<Record<string, boolean>> => {
    const defaults = Object.fromEntries(Object.keys(PERSONNEL_MODULES).map((m) => [m, true]));

    try {
      const response = await fetch(`${authEnv.restUrl}/module_permissions?select=module,enabled`, {
        headers: { apikey: authEnv.anonKey },
        cache: "no-store",
      });
      if (!response.ok) return defaults;

      const rows = (await response.json()) as { module: string; enabled: boolean }[];
      const result = { ...defaults };
      for (const row of rows) {
        if (isPersonnelModule(row.module)) result[row.module] = row.enabled;
      }
      return result;
    } catch {
      return defaults;
    }
  },
  ["module-permissions"],
  { tags: ["module-permissions"] }
);

export const getPersonnelPermissions = cache(fetchPersonnelPermissions);

export async function isModuleEnabledForPersonnel(module: PersonnelModule): Promise<boolean> {
  const permissions = await getPersonnelPermissions();
  return permissions[module] ?? true;
}

/**
 * No `role` parameter exists anywhere in this function's signature — the admin role is never
 * represented in module_permissions at all (see the migration), so there is no argument that
 * could target it. Combined with the RLS admin-only UPDATE policy, this is the structural
 * guarantee behind "admin permissions can't be changed," not a UI-level restriction.
 */
export async function setModulePermission(
  accessToken: string,
  module: PersonnelModule,
  enabled: boolean
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/module_permissions?module=eq.${module}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ enabled, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: data?.message ?? "Failed to update module permission." };
    }
    return {};
  } catch {
    return { error: "Failed to update module permission." };
  }
}
