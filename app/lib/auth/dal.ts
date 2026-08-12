import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE } from "./session";
import { verifyAccessToken } from "./jwt";
import { getPasswordState, isPasswordChangeRequired } from "./password-state";
import { getSecuritySettings } from "@/app/lib/config/security";
import type { AppRole } from "./gotrue";

export interface Session {
  userId: string;
  email: string;
  role: AppRole;
  /** "aal1" = password only, "aal2" = a TOTP factor was verified for this session. */
  aal: string;
}

/**
 * Identity only: a valid, signed token carrying one of the app's two roles. Deliberately does
 * *not* apply the 2FA or password-expiry gates, because /change-password has to be reachable by
 * exactly the users those gates are bouncing. Everything else must use verifySession().
 */
export const verifyIdentity = cache(async (): Promise<Session> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const role = payload?.app_metadata?.role;

  if (!payload || (role !== "admin" && role !== "personnel")) {
    redirect("/login");
  }

  return { userId: payload.sub, email: payload.email ?? "", role, aal: payload.aal ?? "aal1" };
});

/**
 * Authoritative session check for Server Components/Actions/Route Handlers.
 * Proxy performs an optimistic version of this same check for fast redirects,
 * but proxy alone is not sufficient defense — this is the real gate.
 *
 * Beyond identity it enforces the two security settings that have no other enforcement point:
 *
 * - Two-Factor Authentication: an `aal1` token is what the password step alone produces, so
 *   accepting one here would let the OTP step be skipped by moving the pending cookie into
 *   raao_at. Sessions created before the setting was turned on are aal1 too, and are likewise
 *   sent back to /login to enrol.
 * - Password Expiry: checked here rather than in a layout because every page *and every server
 *   action* calls this, so a stale tab cannot mutate anything while a change is outstanding.
 */
export const verifySession = cache(async (): Promise<Session> => {
  const session = await verifyIdentity();
  const security = await getSecuritySettings();

  if (security.twoFactorEnabled && session.aal !== "aal2") {
    redirect("/login");
  }

  const passwordState = await getPasswordState(session.userId);
  if (isPasswordChangeRequired(passwordState, security.passwordExpiryDays)) {
    redirect("/change-password");
  }

  return session;
});
