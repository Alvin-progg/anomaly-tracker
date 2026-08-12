import "server-only";
import { authEnv } from "./env";
import type { GoTrueError, GoTrueTokenResponse } from "./gotrue";

/**
 * GoTrue's own TOTP factor endpoints, in the same raw-fetch style as gotrue.ts — the app has no
 * @supabase/supabase-js dependency and no hand-rolled TOTP of its own.
 *
 * The secret lives in `auth.mfa_factors`, which app/lib/backup/pg.ts already dumps (`-n auth`),
 * so enrolled devices survive a restore along with the accounts they belong to.
 *
 * Requires `enroll_enabled` / `verify_enabled` under [auth.mfa.totp] in supabase/config.toml.
 * With them off, every call here returns an error and the login flow refuses the sign-in rather
 * than letting a 2FA-required account through unverified.
 */

export interface MfaFactor {
  id: string;
  factor_type: string;
  status: "verified" | "unverified";
  friendly_name?: string;
}

export interface MfaEnrollment {
  id: string;
  totp: {
    /** SVG markup rendered by GoTrue itself — see app/login/verify/enrol-form.tsx. */
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export interface MfaChallenge {
  id: string;
  expires_at: number;
}

function headers(accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: authEnv.anonKey,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function request<T>(
  path: string,
  accessToken: string,
  init?: { method: string; body?: unknown }
): Promise<T | GoTrueError> {
  try {
    const response = await fetch(`${authEnv.authUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: headers(accessToken),
      ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      cache: "no-store",
    });

    // DELETE /factors/{id} answers 200 with a body, but treat an empty body as success anyway.
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return { error: data?.error_description ?? data?.msg ?? data?.error ?? "mfa_request_failed" };
    }

    return (data ?? {}) as T;
  } catch {
    return { error: "Could not reach the authentication server." };
  }
}

/**
 * GoTrue exposes a user's factors on the user object rather than on a list endpoint, so this
 * reads GET /user and picks them off it.
 */
export async function listFactors(accessToken: string): Promise<MfaFactor[] | GoTrueError> {
  const result = await request<{ factors?: MfaFactor[] }>("/user", accessToken);
  if ("error" in result) return result;
  return result.factors ?? [];
}

/** The one verified TOTP factor an account is expected to have, or null before enrolment. */
export function verifiedTotpFactor(factors: MfaFactor[]): MfaFactor | null {
  return factors.find((factor) => factor.factor_type === "totp" && factor.status === "verified") ?? null;
}

export function enrollTotpFactor(
  accessToken: string,
  friendlyName: string
): Promise<MfaEnrollment | GoTrueError> {
  return request<MfaEnrollment>("/factors", accessToken, {
    method: "POST",
    body: { factor_type: "totp", friendly_name: friendlyName },
  });
}

export function challengeFactor(
  accessToken: string,
  factorId: string
): Promise<MfaChallenge | GoTrueError> {
  return request<MfaChallenge>(`/factors/${factorId}/challenge`, accessToken, { method: "POST" });
}

/**
 * On success GoTrue issues a fresh token pair at `aal2`, structurally compatible with the login
 * response — so it feeds createSession() unchanged — and flips an `unverified` factor to
 * `verified`, which is what completes enrolment.
 */
export function verifyFactor(
  accessToken: string,
  factorId: string,
  challengeId: string,
  code: string
): Promise<GoTrueTokenResponse | GoTrueError> {
  return request<GoTrueTokenResponse>(`/factors/${factorId}/verify`, accessToken, {
    method: "POST",
    body: { challenge_id: challengeId, code },
  });
}

export function unenrollFactor(accessToken: string, factorId: string): Promise<unknown | GoTrueError> {
  return request(`/factors/${factorId}`, accessToken, { method: "DELETE" });
}

/**
 * Abandoned enrolments (the user opened the QR screen and never entered a code) leave an
 * `unverified` factor behind, and `max_enrolled_factors` would eventually reject a new one.
 * Best-effort: failing to tidy up must not block the enrolment that follows.
 */
export async function clearUnverifiedFactors(accessToken: string, factors: MfaFactor[]): Promise<void> {
  for (const factor of factors) {
    if (factor.status === "unverified") {
      await unenrollFactor(accessToken, factor.id);
    }
  }
}
