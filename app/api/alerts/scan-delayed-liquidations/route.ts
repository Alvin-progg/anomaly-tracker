import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { authEnv } from "@/app/lib/auth/env";
import { recordSystemAuditEvent } from "@/app/lib/tracking/tracking";

/**
 * Entry point for the scheduled Delayed Liquidation scan — the one detection rule that can't fire
 * at obligation-creation time (nothing about an obligation changes just by time passing). Next.js
 * has no scheduler of its own, so automation lives in the host's crontab and authenticates with a
 * shared secret rather than a session, same shape as /api/backup/run:
 *
 *   0 6 * * * curl -sf -X POST -H "x-alerts-scan-secret: $ALERTS_SCAN_SECRET" \
 *     http://localhost:3000/api/alerts/scan-delayed-liquidations
 *
 * proxy.ts leaves this path alone — it is neither a PUBLIC_ROUTES entry nor under /admin, so it
 * falls through to NextResponse.next() and this handler is the only gate.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = authEnv.alertsScanSecret;
  if (!expected) {
    return Response.json(
      { error: "Automated anomaly scans are not configured. Set ALERTS_SCAN_SECRET." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-alerts-scan-secret");
  if (!provided || !secretMatches(provided, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!authEnv.serviceRoleKey) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 503 });
  }

  // Runs with no signed-in personnel session, so this calls PostgREST as service_role rather than
  // a bearer access token — service_role bypasses RLS at the Postgres role level, same as
  // app/lib/auth/admin.ts already relies on for the GoTrue admin API.
  const response = await fetch(`${authEnv.restUrl}/rpc/detect_delayed_liquidations`, {
    method: "POST",
    headers: {
      apikey: authEnv.serviceRoleKey,
      Authorization: `Bearer ${authEnv.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    const detail = await response.text();
    await recordSystemAuditEvent({
      module: "AI Anomaly Alerts",
      action: "Automated delayed-liquidation scan failed",
      details: detail,
    });
    return Response.json({ error: "Scan failed." }, { status: 500 });
  }

  const created = (await response.json()) as unknown[];
  await recordSystemAuditEvent({
    module: "AI Anomaly Alerts",
    action: "Automated delayed-liquidation scan completed",
    details: `${created.length} alert(s) created`,
  });

  return Response.json({ created: created.length });
}
