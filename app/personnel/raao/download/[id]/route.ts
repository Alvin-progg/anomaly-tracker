import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { getRecordById } from "@/app/lib/raao/records";
import { fetchObligationAttachment, originalFileName } from "@/app/lib/raao/attachments";

export async function GET(_request: Request, ctx: RouteContext<"/personnel/raao/download/[id]">) {
  const session = await verifySession();
  if (session.role !== "personnel") {
    return new Response("Not authorized.", { status: 403 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response("Session expired.", { status: 401 });
  }

  const { id } = await ctx.params;
  const record = await getRecordById(accessToken, "obligations", id);
  if (!record || !record.attachmentPath) {
    return new Response("Attachment not found.", { status: 404 });
  }

  // The object path always comes from the DB row for this id, never from client input — the
  // Storage bucket's RLS is what actually gates access, this just avoids a pointless round trip.
  const upstream = await fetchObligationAttachment(accessToken, record.attachmentPath);
  if (!upstream.ok || !upstream.body) {
    return new Response("Attachment is missing from storage.", { status: 410 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${originalFileName(record.attachmentPath)}"`,
      "Cache-Control": "no-store",
    },
  });
}
