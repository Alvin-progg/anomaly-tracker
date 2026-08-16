import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { getRecordById, type RaaoTab } from "@/app/lib/raao/records";

const VALID_TABS: RaaoTab[] = ["appropriations", "allotments", "obligations", "liquidations"];

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, ctx: RouteContext<"/personnel/archives/export/[tab]/[id]">) {
  const session = await verifySession();
  if (session.role !== "personnel") {
    return new Response("Not authorized.", { status: 403 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response("Session expired.", { status: 401 });
  }

  const { tab, id } = await ctx.params;
  if (!VALID_TABS.includes(tab as RaaoTab)) {
    return new Response("Unknown record type.", { status: 400 });
  }

  const record = await getRecordById(accessToken, tab as RaaoTab, id);
  if (!record) {
    return new Response("Record not found.", { status: 404 });
  }

  const header = ["Reference No.", "Type", "Fund", "Description", "Amount", "Date", "Status"];
  const row = [
    record.ref,
    tab,
    record.fundShortCode ?? "",
    record.description,
    record.amount.toFixed(2),
    record.recordDate,
    record.status,
  ];
  const csv = `${header.map(csvField).join(",")}\n${row.map((v) => csvField(String(v))).join(",")}\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${record.ref}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
