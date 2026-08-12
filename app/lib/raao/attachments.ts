import "server-only";
import { authEnv } from "@/app/lib/auth/env";

/**
 * Storage-API equivalents of records.ts's PostgREST fetch pattern — same Kong-gateway,
 * apikey+bearer convention, just against /storage/v1 instead of /rest/v1. The raao_at session
 * cookie is httpOnly, so the browser can never attach it to a Storage request directly: upload
 * and download both proxy through server code that already holds the token via getAccessToken(),
 * same as every other RAAO write.
 */

const BUCKET = "raao-attachments";

// "__" (not "-") separates the uuid from the original name so the download route can split it
// back out — crypto.randomUUID() itself contains dashes.
export function obligationAttachmentPath(obligationId: string, fileName: string): string {
  return `obligations/${obligationId}/${crypto.randomUUID()}__${fileName}`;
}

/** Inverse of obligationAttachmentPath — the human-readable name for a Content-Disposition header. */
export function originalFileName(objectPath: string): string {
  const base = objectPath.split("/").pop() ?? objectPath;
  const separatorIndex = base.indexOf("__");
  return separatorIndex === -1 ? base : base.slice(separatorIndex + 2);
}

export async function uploadObligationAttachment(
  accessToken: string,
  objectPath: string,
  file: File
): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.storageUrl}/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: {
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!response.ok) return { error: "Failed to upload attachment." };
    return {};
  } catch {
    return { error: "Failed to upload attachment." };
  }
}

/** Streams the object back; the caller (the download route) is responsible for the response headers. */
export async function fetchObligationAttachment(accessToken: string, objectPath: string): Promise<Response> {
  return fetch(`${authEnv.storageUrl}/object/${BUCKET}/${objectPath}`, {
    headers: { apikey: authEnv.anonKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}
