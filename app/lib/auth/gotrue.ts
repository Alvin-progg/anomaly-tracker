import "server-only";
import { authEnv } from "./env";

export type AppRole = "admin" | "personnel";

export interface GoTrueTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: {
    id: string;
    email: string;
    app_metadata?: { role?: string };
  };
}

export interface GoTrueError {
  error: string;
}

async function tokenRequest(
  grantType: "password" | "refresh_token",
  body: Record<string, string>
): Promise<GoTrueTokenResponse | GoTrueError> {
  const response = await fetch(`${authEnv.authUrl}/token?grant_type=${grantType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: authEnv.anonKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    return { error: data?.error_description ?? data?.error ?? "invalid_grant" };
  }

  return data as GoTrueTokenResponse;
}

export function signInWithPassword(email: string, password: string) {
  return tokenRequest("password", { email, password });
}

export function refreshSession(refreshToken: string) {
  return tokenRequest("refresh_token", { refresh_token: refreshToken });
}

/**
 * Self-service password change (app/change-password). Distinct from admin.ts's updateUser, which
 * sets somebody else's password with the service role; this one acts as the user themselves.
 * `secure_password_change = false` in supabase/config.toml, so GoTrue does not ask for the current
 * password — changePasswordAction re-verifies it before calling this.
 */
export async function updateOwnPassword(
  accessToken: string,
  password: string
): Promise<{ id: string } | GoTrueError> {
  try {
    const response = await fetch(`${authEnv.authUrl}/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return { error: data?.msg ?? data?.error_description ?? data?.error ?? "Failed to change the password." };
    }
    return data as { id: string };
  } catch {
    return { error: "Could not reach the authentication server." };
  }
}

export async function signOut(accessToken: string): Promise<void> {
  await fetch(`${authEnv.authUrl}/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: authEnv.anonKey },
    cache: "no-store",
  }).catch(() => {
    // Best-effort revoke — cookies are cleared regardless by the caller.
  });
}
