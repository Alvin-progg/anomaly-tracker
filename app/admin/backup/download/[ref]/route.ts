import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { getBackupByRef } from "@/app/lib/backup/backups";
import { backupFilePath } from "@/app/lib/backup/pg";

// Reads a dump off disk with node:fs, so it must not run on the Edge runtime.
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/admin/backup/download/[ref]">
) {
  const session = await verifySession();
  if (session.role !== "admin") {
    return new Response("Not authorized.", { status: 403 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response("Session expired.", { status: 401 });
  }

  const { ref } = await ctx.params;
  const backup = await getBackupByRef(accessToken, ref);
  if (!backup || backup.status !== "success") {
    return new Response("Backup not found.", { status: 404 });
  }

  // The path is rebuilt from the stored file name (and re-basename'd inside backupFilePath), never
  // from the URL segment — otherwise this route would be an arbitrary-file read.
  let file: Buffer;
  try {
    file = await readFile(/*turbopackIgnore: true*/ backupFilePath(backup.fileName));
  } catch {
    return new Response("Backup file is missing from the server.", { status: 410 });
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `attachment; filename="${backup.backupRef}.dump"`,
      "Cache-Control": "no-store",
    },
  });
}
