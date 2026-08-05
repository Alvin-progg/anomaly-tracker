import { cookies } from "next/headers";
import { REFRESH_TOKEN_COOKIE, createSession } from "@/app/lib/auth/session";
import { refreshSession } from "@/app/lib/auth/gotrue";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return new Response(null, { status: 401 });
  }

  const result = await refreshSession(refreshToken);
  if ("error" in result) {
    return new Response(null, { status: 401 });
  }

  await createSession(result);
  return new Response(null, { status: 204 });
}
