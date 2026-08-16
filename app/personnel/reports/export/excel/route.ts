import ExcelJS from "exceljs";
import { verifySession } from "@/app/lib/auth/dal";
import type { GeneratedReport } from "@/app/lib/reports/aggregate";

/**
 * The GeneratedReport body was already computed client-side from data the page fetched under the
 * signed-in user's own session — this route never touches PostgREST again, it only turns that
 * already-authorized, already-aggregated result into a binary .xlsx. The session check below is
 * just to keep the endpoint personnel-only, not a data-access boundary.
 */
export async function POST(request: Request) {
  const session = await verifySession();
  if (session.role !== "personnel") {
    return new Response("Not authorized.", { status: 403 });
  }

  const report = (await request.json().catch(() => null)) as GeneratedReport | null;
  if (!report || !Array.isArray(report.tables)) {
    return new Response("Invalid report payload.", { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RAAO Budget Monitoring System";
  workbook.created = new Date();

  for (const table of report.tables) {
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));

    sheet.columns = table.columns.map((col) => ({
      header: col.label,
      key: col.key,
      width: Math.max(col.label.length + 4, 14),
    }));

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
      cell.alignment = { horizontal: "left" };
    });

    for (const row of table.rows) {
      sheet.addRow(row);
    }

    if (table.totalsRow) {
      const totals = sheet.addRow(table.totalsRow);
      totals.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F2F5" } };
      });
    }

    table.columns.forEach((col, i) => {
      if (col.align === "right") {
        sheet.getColumn(i + 1).alignment = { horizontal: "right" };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${report.type}-report-${report.generatedAt.slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
