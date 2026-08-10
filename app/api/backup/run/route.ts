import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { authEnv } from "@/app/lib/auth/env";
import { recordSystemAuditEvent } from "@/app/lib/tracking/tracking";
import { runBackup } from "@/app/lib/backup/pg";

// The engine spawns pg_dump, so this must not run on the Edge runtime.
export const runtime = "nodejs";

/**
 * Entry point for scheduled backups. Next.js has no scheduler of its own, so automation lives in
 * the host's crontab and authenticates with a shared secret rather than a session:
 *
 *   0 2 * * * curl -sf -X POST -H "x-backup-secret: $BACKUP_CRON_SECRET" \
 *     http://localhost:3000/api/backup/run
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
  const expected = authEnv.backupCronSecret;
  if (!expected) {
    return Response.json(
      { error: "Automated backups are not configured. Set BACKUP_CRON_SECRET." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-backup-secret");
  if (!provided || !secretMatches(provided, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runBackup({ type: "automated", triggeredBy: "system" });

  if (!result.ok) {
    await recordSystemAuditEvent({
      module: "Backup",
      action: "Automated backup failed",
      details: result.error,
    });
    return Response.json({ error: result.error }, { status: 500 });
  }

  await recordSystemAuditEvent({
    module: "Backup",
    action: "Automated backup completed",
    details: `${result.ref} — ${result.sizeBytes} bytes`,
  });

  return Response.json({ ref: result.ref, sizeBytes: result.sizeBytes });
}
