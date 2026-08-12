import "server-only";
import { cookies } from "next/headers";
import { authEnv } from "./env";
import { signOut } from "./gotrue";
import { verifyAccessToken } from "./jwt";
import { endSessionTracking, recordAuditEvent } from "@/app/lib/tracking/tracking";

export const ACCESS_TOKEN_COOKIE = "raao_at";
export const REFRESH_TOKEN_COOKIE = "raao_rt";
export const SESSION_ID_COOKIE = "raao_sid";

/**
 * Half-finished sign-in: the password step succeeded but the OTP step has not. These hold a real
 * GoTrue token pair, but at `aal1` — deliberately under different names from the session cookies
 * above, because dal.ts and proxy.ts only ever read ACCESS_TOKEN_COOKIE. A pending token is
 * therefore never a session, and the aal2 check in dal.ts stops one from becoming one.
 */
export const PENDING_ACCESS_TOKEN_COOKIE = "raao_pending_at";
export const PENDING_REFRESH_TOKEN_COOKIE = "raao_pending_rt";

// Outer safety-net ceiling, independent of the idle timeout and the JWT's own expiry.
const MAX_COOKIE_AGE_SECONDS = 60 * 60 * 24;

/** Long enough to fetch a code out of an authenticator app, short enough to be worthless later. */
const PENDING_MAX_AGE_SECONDS = 5 * 60;

function cookieOptions(maxAge = MAX_COOKIE_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: authEnv.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createSession(tokens: { access_token: string; refresh_token: string }) {
  const cookieStore = await cookies();
  const base = cookieOptions();
  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.access_token, base);
  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, base);
}

export async function setSessionIdCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_ID_COOKIE, sessionId, cookieOptions());
}

export async function createPendingSession(tokens: { access_token: string; refresh_token: string }) {
  const cookieStore = await cookies();
  const base = cookieOptions(PENDING_MAX_AGE_SECONDS);
  cookieStore.set(PENDING_ACCESS_TOKEN_COOKIE, tokens.access_token, base);
  cookieStore.set(PENDING_REFRESH_TOKEN_COOKIE, tokens.refresh_token, base);
}

export async function getPendingTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(PENDING_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(PENDING_REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearPendingSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(PENDING_REFRESH_TOKEN_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function endSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const sessionId = cookieStore.get(SESSION_ID_COOKIE)?.value;

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) {
      const role = payload.app_metadata?.role ?? "";
      await Promise.all([
        recordAuditEvent({
          accessToken,
          userId: payload.sub,
          email: payload.email ?? "",
          role,
          action: "Logged out",
        }),
        sessionId ? endSessionTracking({ accessToken, sessionId }) : Promise.resolve(),
      ]).catch(() => {});
    }

    await signOut(accessToken);
  }

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(SESSION_ID_COOKIE);
  cookieStore.delete(PENDING_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(PENDING_REFRESH_TOKEN_COOKIE);
}
