"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { usernameToEmail } from "@/app/lib/auth/username";
import { createUser, setUserBanned, updateUser } from "@/app/lib/auth/admin";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import { getSecuritySettings, getPasswordPolicyError } from "@/app/lib/config/security";
import type { AppRole } from "@/app/lib/auth/gotrue";

export interface UserFormState {
  error?: string;
}

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

function parseRole(value: FormDataEntryValue | null): AppRole | null {
  return value === "admin" || value === "personnel" ? value : null;
}

export async function createUserAction(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));
  const banned = formData.get("status") === "Inactive";

  if (!fullName || !username || !password || !role) {
    return { error: "Please fill in all fields." };
  }

  const policyError = getPasswordPolicyError(password, await getSecuritySettings());
  if (policyError) return { error: policyError };

  const email = usernameToEmail(username);
  const result = await createUser({ email, password, fullName, role, banned });

  if ("error" in result) {
    return { error: result.error };
  }

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Created user account",
    details: email,
  });

  revalidatePath("/admin/users");
  return {};
}

export async function updateUserAction(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));

  if (!id || !fullName || !username || !role) {
    return { error: "Please fill in all fields." };
  }

  if (password) {
    const policyError = getPasswordPolicyError(password, await getSecuritySettings());
    if (policyError) return { error: policyError };
  }

  const email = usernameToEmail(username);
  const result = await updateUser(id, {
    fullName,
    role,
    email,
    ...(password ? { password } : {}),
  });
  if ("error" in result) {
    return { error: result.error };
  }

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated user account",
    details: password ? `${result.email} (password reset)` : result.email,
  });

  revalidatePath("/admin/users");
  return {};
}

export async function toggleUserStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.session) return;

  const id = String(formData.get("id") ?? "");
  const nextBanned = formData.get("nextBanned") === "true";
  if (!id) return;

  const result = await setUserBanned(id, nextBanned);
  if ("error" in result) {
    console.error("toggleUserStatusAction failed:", result.error);
    return;
  }

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: nextBanned ? "Deactivated user account" : "Reactivated user account",
    details: result.email,
  });

  revalidatePath("/admin/users");
}
