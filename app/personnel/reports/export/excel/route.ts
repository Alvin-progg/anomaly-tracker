import ExcelJS from "exceljs";
import { verifySession } from "@/app/lib/auth/dal";
import type { GeneratedReport, ReportColumn } from "@/app/lib/reports/aggregate";

/**
 * The GeneratedReport body was already computed client-side from data the page fetched under the
 * signed-in user's own session — this route never touches PostgREST again, it only turns that
 * already-authorized, already-aggregated result into a binary .xlsx. The session check below is
 * just to keep the endpoint personnel-only, not a data-access boundary.
 */

/**
 * Excel rejects : \ / ? * [ ] in a sheet name and truncates past 31 characters. Both bite here:
 * the SAAO report titles its tables "Office/Department : <NAME>", which is illegal on the first
 * count and — once truncated — identical across departments on the second. Sanitise, then dedupe.
 */
function sheetName(title: string, used: Set<string>): string {
  const cleaned = title.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim() || "Sheet";
  let name = cleaned.slice(0, 31);
  let n = 2;
  while (used.has(name)) {
    const suffix = ` (${n})`;
    name = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(name);
  return name;
}

/**
 * Mirrors the two-row header the SAAO report prints: ungrouped columns merge vertically across
 * both rows, and a run of columns sharing a `group` merges horizontally under that group's name.
 * Returns how many header rows were written.
 */
function writeHeader(sheet: ExcelJS.Worksheet, columns: ReportColumn[]): number {
  const hasGroups = columns.some((column) => column.group);

  if (!hasGroups) {
    const row = sheet.addRow(columns.map((column) => column.label));
    row.font = { bold: true };
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    return 1;
  }

  const top = sheet.addRow(columns.map((column) => column.group ?? column.label));
  const bottom = sheet.addRow(columns.map((column) => (column.group ? column.label : "")));
  for (const row of [top, bottom]) {
    row.font = { bold: true };
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  const topIndex = top.number;
  const bottomIndex = bottom.number;
  let i = 0;
  while (i < columns.length) {
    const column = columns[i];
    if (!column.group) {
      sheet.mergeCells(topIndex, i + 1, bottomIndex, i + 1);
      i += 1;
      continue;
    }
    let end = i;
    while (end + 1 < columns.length && columns[end + 1].group === column.group) end += 1;
    if (end > i) sheet.mergeCells(topIndex, i + 1, topIndex, end + 1);
    i = end + 1;
  }

  return 2;
}

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

  const usedNames = new Set<string>();

  for (const table of report.tables) {
    const sheet = workbook.addWorksheet(sheetName(table.title, usedNames));

    // Keys and widths only — the header rows are written by hand below so grouped columns can be
    // merged, which `columns[].header` cannot express.
    sheet.columns = table.columns.map((column) => ({
      key: column.key,
      width: Math.max(column.label.length + 4, 14),
    }));

    // Set column alignment before writing any rows: a column style is the fallback, and the
    // header rows then override it with their own centring.
    table.columns.forEach((column, i) => {
      if (column.align === "right") {
        sheet.getColumn(i + 1).alignment = { horizontal: "right" };
      }
    });

    writeHeader(sheet, table.columns);

    for (const row of table.rows) {
      sheet.addRow(row);
    }

    if (table.totalsRow) {
      const totals = sheet.addRow(table.totalsRow);
      totals.font = { bold: true };
    }
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
