"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import { updateSecuritySettings } from "@/app/lib/config/security";

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

export interface PasswordPolicyInput {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecial: boolean;
  passwordPreventReuse: boolean;
  passwordExpiryDays: number;
}

export async function updatePasswordPolicyAction(input: PasswordPolicyInput): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  if (![8, 10, 12].includes(input.passwordMinLength)) {
    return { error: "Invalid minimum length." };
  }
  if (!Number.isInteger(input.passwordExpiryDays) || input.passwordExpiryDays < 1) {
    return { error: "Password expiry must be a positive number of days." };
  }

  const result = await updateSecuritySettings(admin.accessToken, {
    passwordMinLength: input.passwordMinLength as 8 | 10 | 12,
    passwordRequireUppercase: input.passwordRequireUppercase,
    passwordRequireNumbers: input.passwordRequireNumbers,
    passwordRequireSpecial: input.passwordRequireSpecial,
    passwordPreventReuse: input.passwordPreventReuse,
    passwordExpiryDays: input.passwordExpiryDays,
  });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated password policy",
    details: `Min length ${input.passwordMinLength}, expiry ${input.passwordExpiryDays} days`,
  });

  revalidatePath("/admin/security");
  return {};
}

export interface SessionAuthInput {
  sessionTimeoutMinutes: number;
  twoFactorEnabled: boolean;
  encryptionStandard: "aes256" | "aes128";
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export async function updateSessionAuthAction(input: SessionAuthInput): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  if (!Number.isInteger(input.sessionTimeoutMinutes) || input.sessionTimeoutMinutes < 5 || input.sessionTimeoutMinutes > 60) {
    return { error: "Session timeout must be between 5 and 60 minutes." };
  }
  if (input.encryptionStandard !== "aes256" && input.encryptionStandard !== "aes128") {
    return { error: "Invalid encryption standard." };
  }
  if (!Number.isInteger(input.maxFailedLoginAttempts) || input.maxFailedLoginAttempts < 1) {
    return { error: "Max failed login attempts must be a positive number." };
  }
  if (!Number.isInteger(input.lockoutDurationMinutes) || input.lockoutDurationMinutes < 1) {
    return { error: "Lockout duration must be a positive number of minutes." };
  }

  const result = await updateSecuritySettings(admin.accessToken, {
    sessionTimeoutMinutes: input.sessionTimeoutMinutes,
    twoFactorEnabled: input.twoFactorEnabled,
    encryptionStandard: input.encryptionStandard,
    maxFailedLoginAttempts: input.maxFailedLoginAttempts,
    lockoutDurationMinutes: input.lockoutDurationMinutes,
  });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated session & authentication settings",
    details: `Timeout ${input.sessionTimeoutMinutes}m, max attempts ${input.maxFailedLoginAttempts}, lockout ${input.lockoutDurationMinutes}m`,
  });

  revalidatePath("/admin/security");
  return {};
}
