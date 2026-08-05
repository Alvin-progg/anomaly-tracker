import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE } from "./session";
import { verifyAccessToken } from "./jwt";
import type { AppRole } from "./gotrue";

export interface Session {
  userId: string;
  email: string;
  role: AppRole;
}

/**
 * Authoritative session check for Server Components/Actions/Route Handlers.
 * Proxy performs an optimistic version of this same check for fast redirects,
 * but proxy alone is not sufficient defense — this is the real gate.
 */
export const verifySession = cache(async (): Promise<Session> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const role = payload?.app_metadata?.role;

  if (!payload || (role !== "admin" && role !== "personnel")) {
    redirect("/login");
  }

  return { userId: payload.sub, email: payload.email ?? "", role };
});
