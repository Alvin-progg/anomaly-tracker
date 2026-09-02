import ExcelJS from "exceljs";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import type { GeneratedReport, ReportColumn, ReportTable } from "@/app/lib/reports/aggregate";

/**
 * The GeneratedReport body was already computed client-side from data the page fetched under the
 * signed-in user's own session — this route never touches PostgREST again, it only turns that
 * already-authorized, already-aggregated result into a binary .xlsx.
 *
 * That argument covers the *values*. It does not cover the *shape*: the body is still whatever the
 * client posted, so it is validated below before anything indexes into it.
 */

/**
 * Excel rejects : \ / ? * [ ] in a sheet name, rejects a leading or trailing apostrophe, and
 * truncates past 31 characters. All three bite here: the SAAO report titles its tables
 * "Office/Department : <NAME>", which is illegal on the first count and — once truncated —
 * identical across departments on the second. Strip the prefix noise, then dedupe.
 */
function sheetName(title: string, used: Set<string>): string {
  const cleaned =
    title
      .replace(/^Office\/Department\s*:\s*/i, "")
      .replace(/[:\\/?*[\]]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^'+|'+$/g, "")
      .trim() || "Sheet";
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

const MONEY_FORMAT = "#,##0.00";
const PERCENT_LABEL = /%$/;

/**
 * The aggregation layer formats everything to display strings before it gets here. Writing those
 * through verbatim produced a workbook nobody could sum, sort or chart — the one thing .xlsx offers
 * over the printed PDF. Recover the number where the string is one, and leave nil cells empty so
 * they do not pollute a SUM.
 */
function toCell(value: string | undefined): { value: string | number | null; money: boolean } {
  const text = (value ?? "").trim();
  if (text === "" || text === "-" || text === "—") return { value: null, money: false };
  if (PERCENT_LABEL.test(text)) {
    const pct = Number(text.slice(0, -1).replace(/,/g, ""));
    return Number.isFinite(pct) ? { value: pct / 100, money: false } : { value: text, money: false };
  }
  const numeric = Number(text.replace(/[₱,\s]/g, ""));
  if (Number.isFinite(numeric) && /\d/.test(text) && !/[A-Za-z]/.test(text)) {
    return { value: numeric, money: true };
  }
  return { value: text, money: false };
}

/**
 * Mirrors the two-row header the SAAO report prints: ungrouped columns merge vertically across both
 * rows, and a contiguous run of columns sharing a `group` merges horizontally under that name.
 */
function writeHeader(sheet: ExcelJS.Worksheet, columns: ReportColumn[]): void {
  const hasGroups = columns.some((column) => column.group);

  if (!hasGroups) {
    const row = sheet.addRow(columns.map((column) => column.label));
    row.font = { bold: true };
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    return;
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
}

const MAX_TABLES = 64;
const MAX_ROWS_PER_TABLE = 20_000;

function isColumn(value: unknown): value is ReportColumn {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<ReportColumn>;
  return typeof c.key === "string" && typeof c.label === "string";
}

function isTable(value: unknown): value is ReportTable {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Partial<ReportTable>;
  return (
    typeof t.title === "string" &&
    Array.isArray(t.columns) &&
    t.columns.length > 0 &&
    t.columns.every(isColumn) &&
    Array.isArray(t.rows) &&
    t.rows.length <= MAX_ROWS_PER_TABLE
  );
}

function isReport(value: unknown): value is GeneratedReport {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<GeneratedReport>;
  return (
    typeof r.type === "string" &&
    typeof r.generatedAt === "string" &&
    Array.isArray(r.tables) &&
    r.tables.length <= MAX_TABLES &&
    r.tables.every(isTable)
  );
}

/** Content-Disposition is a header: anything from the payload has to be tamed before it lands there. */
function safeFilename(report: GeneratedReport): string {
  const type = report.type.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "report";
  const day = /^\d{4}-\d{2}-\d{2}/.test(report.generatedAt) ? report.generatedAt.slice(0, 10) : "export";
  return `${type}-report-${day}.xlsx`;
}

export async function POST(request: Request) {
  const session = await verifySession();
  if (session.role !== "personnel") {
    return new Response("Not authorized.", { status: 403 });
  }

  // The page is gated on this module; without the same check here, disabling Report Generation
  // hides the screen but leaves the export endpoint fully usable.
  if (!(await isModuleEnabledForPersonnel("reports"))) {
    return new Response("Report Generation is disabled.", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isReport(body)) {
    return new Response("Invalid report payload.", { status: 400 });
  }
  const report = body;

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

    writeHeader(sheet, table.columns);

    const writeBody = (source: Record<string, string>, bold: boolean) => {
      const row = sheet.addRow([]);
      table.columns.forEach((column, i) => {
        const { value, money } = toCell(source[column.key]);
        const target = row.getCell(i + 1);
        target.value = value;
        if (money) target.numFmt = MONEY_FORMAT;
        if (typeof value === "number" || column.align === "right") {
          target.alignment = { horizontal: "right" };
        }
      });
      if (bold) row.font = { bold: true };
    };

    for (const row of table.rows) writeBody(row, false);
    if (table.totalsRow) writeBody(table.totalsRow, true);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = safeFilename(report);

  const accessToken = await getAccessToken();
  if (accessToken) {
    await recordAuditEvent({
      accessToken,
      userId: session.userId,
      email: session.email,
      role: session.role,
      module: "Report Generation",
      action: "Exported report",
      details: `${report.typeLabel ?? report.type} — ${report.fiscalYearLabel ?? "unspecified fiscal year"}`,
    });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
