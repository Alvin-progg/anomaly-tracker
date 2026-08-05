import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/app/lib/auth/session";
import { verifyAccessToken } from "@/app/lib/auth/jwt";

const PUBLIC_ROUTES = new Set(["/", "/login"]);

function portalFor(role: string | undefined): string | null {
  if (role === "admin") return "/admin";
  if (role === "personnel") return "/personnel";
  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const portal = portalFor(payload?.app_metadata?.role);

  if (PUBLIC_ROUTES.has(pathname)) {
    if (portal) {
      return NextResponse.redirect(new URL(portal, request.url));
    }
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isPersonnelRoute = pathname.startsWith("/personnel");

  if (isAdminRoute || isPersonnelRoute) {
    if (!portal) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const wrongPortal = (isAdminRoute && portal !== "/admin") || (isPersonnelRoute && portal !== "/personnel");
    if (wrongPortal) {
      return NextResponse.redirect(new URL(portal, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
