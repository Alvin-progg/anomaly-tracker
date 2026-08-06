"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import { setModulePermission } from "@/app/lib/permissions/permissions";
import { PERSONNEL_MODULES, isPersonnelModule } from "@/app/lib/permissions/modules";

async function requireAdmin() {
  const session = await verifySession();
  if (session.role !== "admin") {
    return { session: null, error: "Not authorized." } as const;
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { session: null, error: "Session expired." } as const;
  }
  return { session, accessToken, error: null } as const;
}

export async function updateModulePermissionAction(module: string, enabled: boolean): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  // Defense in depth beyond the RLS admin-only UPDATE policy and this function taking no
  // `role` parameter at all — module_permissions only ever holds personnel modules.
  if (!isPersonnelModule(module)) {
    return { error: "Invalid module." };
  }

  const result = await setModulePermission(admin.accessToken, module, enabled);
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated module permission",
    details: `${PERSONNEL_MODULES[module]}: ${enabled ? "enabled" : "disabled"} for Budget Personnel`,
  });

  revalidatePath("/admin/roles");
  return {};
}
