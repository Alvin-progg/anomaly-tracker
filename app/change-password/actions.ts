"use server";

import { redirect } from "next/navigation";
import { verifyIdentity } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { signInWithPassword, updateOwnPassword } from "@/app/lib/auth/gotrue";
import { markPasswordChanged } from "@/app/lib/auth/password-state";
import { getPasswordPolicyError, getSecuritySettings } from "@/app/lib/config/security";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";

export interface ChangePasswordFormState {
  error?: string;
}

/**
 * Self-service password change — the escape hatch from the Password Expiry gate in dal.ts, and
 * reachable at any time from the header.
 *
 * Uses verifyIdentity() rather than verifySession() on purpose: verifySession() is what redirects
 * expired users here, so calling it would bounce them off the one page that can clear the flag.
 */
export async function changePasswordAction(
  _prevState: ChangePasswordFormState | undefined,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const session = await verifyIdentity();
  const accessToken = await getAccessToken();
  if (!accessToken) return { error: "Session expired. Please sign in again." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Please fill in all fields." };
  }

  // GoTrue does not ask for the current password (secure_password_change = false), so verify it
  // here — otherwise a borrowed session could silently take over the account. Deliberately NOT
  // counted as a failed login attempt: a user fumbling their own password must not lock
  // themselves out of the screen they are being forced to use.
  const reauth = await signInWithPassword(session.email, currentPassword);
  if ("error" in reauth) {
    return { error: "Current password is incorrect." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }
  if (newPassword === currentPassword) {
    return { error: "New password must be different from your current password." };
  }

  const policyError = getPasswordPolicyError(newPassword, await getSecuritySettings());
  if (policyError) return { error: policyError };

  const result = await updateOwnPassword(accessToken, newPassword);
  if ("error" in result) return { error: result.error };

  await markPasswordChanged(session.userId, { mustChange: false });

  await recordAuditEvent({
    accessToken,
    userId: session.userId,
    email: session.email,
    role: session.role,
    action: "Changed password",
  });

  redirect(session.role === "admin" ? "/admin" : "/personnel");
}
