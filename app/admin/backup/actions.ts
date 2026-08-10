"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_ID_COOKIE,
  getAccessToken,
} from "@/app/lib/auth/session";
import { recordAuditEvent, recordSystemAuditEvent } from "@/app/lib/tracking/tracking";
import { getBackupByRef } from "@/app/lib/backup/backups";
import { restoreBackup, runBackup } from "@/app/lib/backup/pg";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 2)} ${units[unit]}`;
}

export async function runBackupAction(): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const result = await runBackup({ type: "manual", triggeredBy: admin.session.email });
  if (!result.ok) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    module: "Backup",
    action: "Ran manual backup",
    details: `${result.ref} — ${formatBytes(result.sizeBytes)}`,
  });

  revalidatePath("/admin/backup");
  return {};
}

/**
 * Restores the whole database from a dump. On success this never returns normally: the restore
 * replaces `auth.users`, so the caller's session refers to a user row that may no longer exist and
 * the only coherent next step is a fresh login.
 *
 * The audit entry is written *after* the restore and through the service role, not before and not
 * with the admin's token — `public.audit_log` is inside the dump, so a pre-restore entry would be
 * erased by the very operation it records.
 */
export async function restoreBackupAction(input: { backupRef: string }): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  if (!input.backupRef) return { error: "Select a backup to restore." };

  const backup = await getBackupByRef(admin.accessToken, input.backupRef);
  if (!backup) return { error: "That backup no longer exists." };

  const result = await restoreBackup({ backup, triggeredBy: admin.session.email });
  if (!result.ok) return { error: result.error };

  await recordSystemAuditEvent({
    module: "Backup",
    action: "Restored database",
    details: `Restored ${result.restoredFrom} (requested by ${admin.session.email}); safety backup ${result.safetyRef}`,
  });

  // Not endSession() — that records an audit event and calls GoTrue sign-out against a database
  // that was just replaced underneath it. Drop the cookies and let the user log in again.
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(SESSION_ID_COOKIE);

  redirect("/login?restored=1");
}
