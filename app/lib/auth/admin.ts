import "server-only";
import { authEnv } from "./env";
import type { AppRole } from "./gotrue";

export interface GoTrueAdminUser {
  id: string;
  email: string;
  last_sign_in_at: string | null;
  banned_until?: string;
  created_at: string;
  app_metadata?: { role?: string };
  user_metadata?: { full_name?: string };
}

export interface GoTrueAdminError {
  error: string;
}

function serviceRoleKey(): string {
  if (!authEnv.serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return authEnv.serviceRoleKey;
}

function adminHeaders(): Record<string, string> {
  const key = serviceRoleKey();
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

export async function listUsers(): Promise<GoTrueAdminUser[]> {
  const response = await fetch(`${authEnv.authUrl}/admin/users`, {
    headers: adminHeaders(),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { users?: GoTrueAdminUser[] };
  return data.users ?? [];
}

export async function createUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  banned: boolean;
}): Promise<GoTrueAdminUser | GoTrueAdminError> {
  const response = await fetch(`${authEnv.authUrl}/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { full_name: params.fullName },
      app_metadata: { role: params.role },
      ...(params.banned ? { ban_duration: "876000h" } : {}),
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    return { error: data?.msg ?? data?.error_description ?? data?.error ?? "Failed to create account." };
  }
  return data as GoTrueAdminUser;
}

export async function updateUser(
  id: string,
  params: { fullName?: string; role?: AppRole; email?: string; password?: string }
): Promise<GoTrueAdminUser | GoTrueAdminError> {
  const body: Record<string, unknown> = {};
  if (params.fullName !== undefined) body.user_metadata = { full_name: params.fullName };
  if (params.role !== undefined) body.app_metadata = { role: params.role };
  if (params.email !== undefined) {
    body.email = params.email;
    // No real mail delivery on this local stack — skip GoTrue's re-confirmation flow,
    // same as createUser already does.
    body.email_confirm = true;
  }
  if (params.password !== undefined) body.password = params.password;

  const response = await fetch(`${authEnv.authUrl}/admin/users/${id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    return { error: data?.msg ?? data?.error_description ?? data?.error ?? "Failed to update account." };
  }
  return data as GoTrueAdminUser;
}

/**
 * Removes every enrolled 2FA factor from an account — the recovery path for a lost or replaced
 * authenticator, which would otherwise lock the user out permanently while the Two-Factor
 * Authentication setting is on. The user re-enrols at their next login.
 */
export async function deleteUserFactors(id: string): Promise<{ removed: number } | GoTrueAdminError> {
  const userResponse = await fetch(`${authEnv.authUrl}/admin/users/${id}`, {
    headers: adminHeaders(),
    cache: "no-store",
  });
  const user = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !user) {
    return { error: user?.msg ?? user?.error_description ?? user?.error ?? "Failed to read the account." };
  }

  const factors = (user.factors ?? []) as { id: string }[];
  for (const factor of factors) {
    const response = await fetch(`${authEnv.authUrl}/admin/users/${id}/factors/${factor.id}`, {
      method: "DELETE",
      headers: adminHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: data?.msg ?? data?.error_description ?? data?.error ?? "Failed to reset 2FA." };
    }
  }

  return { removed: factors.length };
}

export async function setUserBanned(id: string, banned: boolean): Promise<GoTrueAdminUser | GoTrueAdminError> {
  const response = await fetch(`${authEnv.authUrl}/admin/users/${id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({ ban_duration: banned ? "876000h" : "none" }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    return { error: data?.msg ?? data?.error_description ?? data?.error ?? "Failed to update account status." };
  }
  return data as GoTrueAdminUser;
}
