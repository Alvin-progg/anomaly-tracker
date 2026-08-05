import "server-only";
import { cookies } from "next/headers";
import { authEnv } from "./env";
import { signOut } from "./gotrue";

export const ACCESS_TOKEN_COOKIE = "raao_at";
export const REFRESH_TOKEN_COOKIE = "raao_rt";

// Outer safety-net ceiling, independent of the idle timeout and the JWT's own expiry.
const MAX_COOKIE_AGE_SECONDS = 60 * 60 * 24;

export async function createSession(tokens: { access_token: string; refresh_token: string }) {
  const cookieStore = await cookies();
  const base = {
    httpOnly: true,
    secure: authEnv.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_COOKIE_AGE_SECONDS,
  };
  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.access_token, base);
  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, base);
}

export async function endSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    await signOut(accessToken);
  }

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}
