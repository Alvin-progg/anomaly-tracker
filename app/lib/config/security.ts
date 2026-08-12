import "server-only";
import { cache } from "react";
import { authEnv } from "@/app/lib/auth/env";

export interface SecuritySettings {
  passwordMinLength: 8 | 10 | 12;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecial: boolean;
  passwordPreventReuse: boolean;
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  twoFactorEnabled: boolean;
  encryptionStandard: "aes256" | "aes128";
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}

const DEFAULTS: SecuritySettings = {
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecial: true,
  passwordPreventReuse: false,
  passwordExpiryDays: 90,
  // Falls back to today's env-var-driven idle timeout if the DB is unreachable, rather than a
  // hardcoded literal — see app/admin/layout.tsx / app/personnel/layout.tsx.
  sessionTimeoutMinutes: authEnv.idleTimeoutMinutes,
  twoFactorEnabled: false,
  encryptionStandard: "aes256",
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 10,
};

interface SecuritySettingsRow {
  password_min_length: 8 | 10 | 12;
  password_require_uppercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  password_prevent_reuse: boolean;
  password_expiry_days: number;
  session_timeout_minutes: number;
  two_factor_enabled: boolean;
  encryption_standard: "aes256" | "aes128";
  max_failed_login_attempts: number;
  lockout_duration_minutes: number;
}

function fromRow(row: SecuritySettingsRow): SecuritySettings {
  return {
    passwordMinLength: row.password_min_length,
    passwordRequireUppercase: row.password_require_uppercase,
    passwordRequireNumbers: row.password_require_numbers,
    passwordRequireSpecial: row.password_require_special,
    passwordPreventReuse: row.password_prevent_reuse,
    passwordExpiryDays: row.password_expiry_days,
    sessionTimeoutMinutes: row.session_timeout_minutes,
    twoFactorEnabled: row.two_factor_enabled,
    encryptionStandard: row.encryption_standard,
    maxFailedLoginAttempts: row.max_failed_login_attempts,
    lockoutDurationMinutes: row.lockout_duration_minutes,
  };
}

/**
 * Read with the anon key and no bearer, because loginAction needs these values before a session
 * exists (see the public-read RLS policy in 20260806130000_security_settings.sql).
 *
 * `cache: "no-store"` keeps an admin's edit from being served stale, and the React `cache()`
 * wrapper on top collapses the several reads a single request now makes — the layout's idle
 * timeout, verifySession's 2FA/expiry gates, and any action's password policy check — into one
 * PostgREST round trip. Per-request memo only; it does not survive to the next request.
 */
export const getSecuritySettings = cache(async (): Promise<SecuritySettings> => {
  try {
    const response = await fetch(`${authEnv.restUrl}/security_settings?select=*&id=eq.1`, {
      headers: { apikey: authEnv.anonKey },
      cache: "no-store",
    });
    if (!response.ok) return DEFAULTS;

    const rows = (await response.json()) as SecuritySettingsRow[];
    return rows[0] ? fromRow(rows[0]) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
});

export async function updateSecuritySettings(
  accessToken: string,
  patch: Partial<SecuritySettings>
): Promise<{ error?: string }> {
  const body: Partial<SecuritySettingsRow> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.passwordMinLength !== undefined) body.password_min_length = patch.passwordMinLength;
  if (patch.passwordRequireUppercase !== undefined) body.password_require_uppercase = patch.passwordRequireUppercase;
  if (patch.passwordRequireNumbers !== undefined) body.password_require_numbers = patch.passwordRequireNumbers;
  if (patch.passwordRequireSpecial !== undefined) body.password_require_special = patch.passwordRequireSpecial;
  if (patch.passwordPreventReuse !== undefined) body.password_prevent_reuse = patch.passwordPreventReuse;
  if (patch.passwordExpiryDays !== undefined) body.password_expiry_days = patch.passwordExpiryDays;
  if (patch.sessionTimeoutMinutes !== undefined) body.session_timeout_minutes = patch.sessionTimeoutMinutes;
  if (patch.twoFactorEnabled !== undefined) body.two_factor_enabled = patch.twoFactorEnabled;
  if (patch.encryptionStandard !== undefined) body.encryption_standard = patch.encryptionStandard;
  if (patch.maxFailedLoginAttempts !== undefined) body.max_failed_login_attempts = patch.maxFailedLoginAttempts;
  if (patch.lockoutDurationMinutes !== undefined) body.lockout_duration_minutes = patch.lockoutDurationMinutes;

  try {
    const response = await fetch(`${authEnv.restUrl}/security_settings?id=eq.1`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: data?.message ?? "Failed to update security settings." };
    }
    return {};
  } catch {
    return { error: "Failed to update security settings." };
  }
}

/**
 * Pure validator, no I/O — reused by app/admin/users/actions.ts so password policy is
 * enforced wherever a password is set, not just from the Security Policies form itself.
 */
export function getPasswordPolicyError(password: string, settings: SecuritySettings): string | null {
  if (password.length < settings.passwordMinLength) {
    return `Password must be at least ${settings.passwordMinLength} characters.`;
  }
  if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (settings.passwordRequireNumbers && !/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  if (settings.passwordRequireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a special character.";
  }
  return null;
}
