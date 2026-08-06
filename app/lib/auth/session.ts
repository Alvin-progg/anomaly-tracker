import "server-only";
import { cookies } from "next/headers";
import { authEnv } from "./env";
import { signOut } from "./gotrue";
import { verifyAccessToken } from "./jwt";
import { endSessionTracking, recordAuditEvent } from "@/app/lib/tracking/tracking";

export const ACCESS_TOKEN_COOKIE = "raao_at";
export const REFRESH_TOKEN_COOKIE = "raao_rt";
export const SESSION_ID_COOKIE = "raao_sid";

// Outer safety-net ceiling, independent of the idle timeout and the JWT's own expiry.
const MAX_COOKIE_AGE_SECONDS = 60 * 60 * 24;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: authEnv.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_COOKIE_AGE_SECONDS,
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
}
