import type { RaaoRecord } from "@/app/lib/raao/records";
import type { AnomalyAlert } from "@/app/lib/budget/dashboard";
import type { FundClassification } from "@/app/lib/config/funds";
import { formatAmount, percentOf } from "@/app/lib/budget/format";

/**
 * Pure aggregation over already-fetched, already-authorized data — no "server-only" here on
 * purpose, this runs client-side in reports-content.tsx over the arrays page.tsx fetched once,
 * same convention as every other filter/table module in this app (Archives, RAAO Records, the
 * audit log table).
 *
 * Everything built here is rendered inside a `.print-area`, so it follows the paper rules stated in
 * app/components/ui/paper.tsx: bare grouped figures, no ₱ inside a cell, a plain hyphen for nil.
 */

export type ReportType = "fund_status" | "department_saao" | "fund_utilization" | "department" | "anomaly";

export const ALL_FISCAL_YEARS = "All";

export interface ReportFilters {
  type: ReportType;
  /** Fiscal year id, or ALL_FISCAL_YEARS. */
  fiscalYearId: string;
  /** "All" or a fund short code. Ignored by "anomaly" — alerts carry no fund. */
  fund: string;
  /** "" = unbounded. */
  from: string;
  to: string;
}

/**
 * `usesFiscalYear` is false for alerts: `anomaly_alerts` has no `fiscal_year_id` column, so scoping
 * them by year would silently drop every row rather than filter honestly.
 */
export const REPORT_TYPES: { value: ReportType; label: string; usesFund: boolean; usesFiscalYear: boolean }[] = [
  { value: "fund_status", label: "Fund Status Summary", usesFund: true, usesFiscalYear: true },
  {
    value: "department_saao",
    label: "Status of Appropriation, Allotment and Obligations (by Office)",
    usesFund: true,
    usesFiscalYear: true,
  },
  { value: "fund_utilization", label: "Fund Utilization Summary", usesFund: true, usesFiscalYear: true },
  { value: "department", label: "Utilization by Department", usesFund: true, usesFiscalYear: true },
  { value: "anomaly", label: "AI Anomaly Alerts Summary", usesFund: false, usesFiscalYear: false },
];

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  /**
   * Optional spanning header. Consecutive columns sharing a `group` print under one merged cell in
   * a second header row — the SAAO sheet's `Balance` over `Allotment` / `Appropriations`. Columns
   * without one get a header cell spanning both rows.
   */
  group?: string;
}

export interface ReportTable {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string>[];
  totalsRow?: Record<string, string>;
}

export interface GeneratedReport {
  type: ReportType;
  typeLabel: string;
  fundLabel: string;
  /** Resolved label of the chosen year, or "All fiscal years". Printed in the sheet header. */
  fiscalYearLabel: string;
  from: string;
  to: string;
  generatedAt: string;
  /** True when any source table hit its row cap — the totals below are then incomplete. */
  truncated: boolean;
  tables: ReportTable[];
}

export interface ReportRawData {
  appropriations: RaaoRecord[];
  allotments: RaaoRecord[];
  obligations: RaaoRecord[];
  alerts: AnomalyAlert[];
  fundClassifications: FundClassification[];
  truncated: boolean;
}

function inRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/**
 * Every figure here lands on paper, so it follows the form's convention: grouped to 2 dp, no
 * currency symbol, plain hyphen for nil. `formatPeso` is for on-screen app chrome only.
 */
function paperOrDash(n: number): string {
  return n !== 0 ? formatAmount(n) : "-";
}

function pctOrDash(part: number, whole: number): string {
  return percentOf(part, whole) ?? "-";
}

function filterRecords(rows: RaaoRecord[], filters: ReportFilters): RaaoRecord[] {
  return rows.filter(
    (r) =>
      inRange(r.recordDate, filters.from, filters.to) &&
      (filters.fund === "All" || r.fundShortCode === filters.fund) &&
      (filters.fiscalYearId === ALL_FISCAL_YEARS || r.fiscalYearId === filters.fiscalYearId)
  );
}

interface FundTotals {
  fund: string;
  appropriated: number;
  allotted: number;
  obligated: number;
}

function groupByFund(appropriations: RaaoRecord[], allotments: RaaoRecord[], obligations: RaaoRecord[], filters: ReportFilters): FundTotals[] {
  const byFund = new Map<string, FundTotals>();
  const ensure = (r: RaaoRecord): FundTotals => {
    const key = r.fundShortCode ?? "-";
    let entry = byFund.get(key);
    if (!entry) {
      entry = { fund: r.fundName ?? key, appropriated: 0, allotted: 0, obligated: 0 };
      byFund.set(key, entry);
    }
    return entry;
  };
  for (const r of filterRecords(appropriations, filters)) ensure(r).appropriated += r.amount;
  for (const r of filterRecords(allotments, filters)) ensure(r).allotted += r.amount;
  for (const r of filterRecords(obligations, filters)) ensure(r).obligated += r.amount;
  return Array.from(byFund.values()).sort((a, b) => a.fund.localeCompare(b.fund));
}

function sumFundTotals(funds: FundTotals[]) {
  return funds.reduce(
    (acc, f) => ({
      appropriated: acc.appropriated + f.appropriated,
      allotted: acc.allotted + f.allotted,
      obligated: acc.obligated + f.obligated,
    }),
    { appropriated: 0, allotted: 0, obligated: 0 }
  );
}

function buildFundStatusReport(appropriations: RaaoRecord[], allotments: RaaoRecord[], obligations: RaaoRecord[], filters: ReportFilters): ReportTable {
  const funds = groupByFund(appropriations, allotments, obligations, filters);
  const totals = sumFundTotals(funds);
  return {
    title: "Fund Status Summary",
    columns: [
      { key: "fund", label: "Fund", align: "left" },
      { key: "appropriation", label: "Appropriation", align: "right" },
      { key: "allotment", label: "Allotment", align: "right" },
      { key: "obligation", label: "Obligation", align: "right" },
      { key: "balance", label: "Balance", align: "right" },
      { key: "utilized", label: "% Utilized", align: "right" },
    ],
    rows: funds.map((f) => ({
      fund: f.fund,
      appropriation: paperOrDash(f.appropriated),
      allotment: paperOrDash(f.allotted),
      obligation: paperOrDash(f.obligated),
      balance: paperOrDash(f.allotted - f.obligated),
      utilized: pctOrDash(f.obligated, f.allotted),
    })),
    totalsRow: {
      fund: "TOTAL",
      appropriation: paperOrDash(totals.appropriated),
      allotment: paperOrDash(totals.allotted),
      obligation: paperOrDash(totals.obligated),
      balance: paperOrDash(totals.allotted - totals.obligated),
      utilized: pctOrDash(totals.obligated, totals.allotted),
    },
  };
}

/**
 * The SAAO sheet as the Budget Office files it — one table per office, and `Balance` split into
 * its two distinct subtractions (see `sample/SAAO- ELEMENTARY EDUCATION with data.png`).
 *
 * Two things it deliberately does not do, both because the ledger cannot support them:
 *
 *  - **No MOOE / Capital Outlay sections.** The printed sheet groups activities by expense class,
 *    but `appropriations`/`allotments`/`obligations` carry no expense-class column — "MOOE" and
 *    "PS" appear only as free text inside `description`, and only on some rows. Inventing the
 *    grouping by parsing that text would mis-bucket every row that does not follow the convention.
 *    Use Document Creation for a sheet that needs the sections; they are typed there.
 *  - **Rows are per fund, not per activity.** The three ledgers word the same programme
 *    differently ("MOOE – Municipal Health Office" is released as "Q1–Q3 Release – Municipal
 *    Health" and obligated as "Medicines & Medical Supplies – MHO"), and no column links a
 *    release back to what it released. Department plus fund is the only key on which the three
 *    reconcile, so that is the row. The activity cell lists the appropriation descriptions behind
 *    each row so the programme is still named.
 */
function buildDepartmentSaaoReports(
  appropriations: RaaoRecord[],
  allotments: RaaoRecord[],
  obligations: RaaoRecord[],
  filters: ReportFilters
): ReportTable[] {
  interface Cell {
    fund: string;
    descriptions: string[];
    appropriated: number;
    allotted: number;
    obligated: number;
  }

  const byDept = new Map<string, Map<string, Cell>>();

  const ensure = (record: RaaoRecord): Cell => {
    const dept = record.departmentName ?? "-";
    const fundKey = record.fundShortCode ?? "-";
    let funds = byDept.get(dept);
    if (!funds) {
      funds = new Map();
      byDept.set(dept, funds);
    }
    let entry = funds.get(fundKey);
    if (!entry) {
      entry = { fund: record.fundName ?? fundKey, descriptions: [], appropriated: 0, allotted: 0, obligated: 0 };
      funds.set(fundKey, entry);
    }
    return entry;
  };

  for (const record of filterRecords(appropriations, filters)) {
    const entry = ensure(record);
    entry.appropriated += record.amount;
    if (!entry.descriptions.includes(record.description)) entry.descriptions.push(record.description);
  }
  for (const record of filterRecords(allotments, filters)) ensure(record).allotted += record.amount;
  for (const record of filterRecords(obligations, filters)) ensure(record).obligated += record.amount;

  const columns: ReportColumn[] = [
    { key: "activity", label: "Function/Program/Project Activity", align: "left" },
    { key: "appropriations", label: "APPROPRIATIONS", align: "right" },
    { key: "allotment", label: "ALLOTMENT", align: "right" },
    { key: "obligation", label: "OBLIGATION", align: "right" },
    { key: "balanceAllotment", label: "Allotment", align: "right", group: "Balance" },
    { key: "balanceAppropriations", label: "Appropriations", align: "right", group: "Balance" },
  ];

  return Array.from(byDept.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([department, funds]) => {
      const cells = Array.from(funds.values()).sort((a, b) => a.fund.localeCompare(b.fund));
      const totals = cells.reduce(
        (acc, c) => ({
          appropriated: acc.appropriated + c.appropriated,
          allotted: acc.allotted + c.allotted,
          obligated: acc.obligated + c.obligated,
        }),
        { appropriated: 0, allotted: 0, obligated: 0 }
      );

      return {
        title: `Office/Department : ${department.toUpperCase()}`,
        columns,
        rows: cells.map((c) => ({
          activity: c.descriptions.length > 0 ? `${c.fund} — ${c.descriptions.join("; ")}` : c.fund,
          appropriations: paperOrDash(c.appropriated),
          allotment: paperOrDash(c.allotted),
          obligation: paperOrDash(c.obligated),
          balanceAllotment: paperOrDash(c.allotted - c.obligated),
          balanceAppropriations: paperOrDash(c.appropriated - c.allotted),
        })),
        totalsRow: {
          activity: "GRANDTOTAL",
          appropriations: paperOrDash(totals.appropriated),
          allotment: paperOrDash(totals.allotted),
          obligation: paperOrDash(totals.obligated),
          balanceAllotment: paperOrDash(totals.allotted - totals.obligated),
          balanceAppropriations: paperOrDash(totals.appropriated - totals.allotted),
        },
      };
    });
}

function buildFundUtilizationReport(appropriations: RaaoRecord[], allotments: RaaoRecord[], obligations: RaaoRecord[], filters: ReportFilters): ReportTable {
  const funds = groupByFund(appropriations, allotments, obligations, filters);
  const totals = sumFundTotals(funds);
  return {
    title: "Fund Utilization Summary",
    columns: [
      { key: "fund", label: "Fund", align: "left" },
      { key: "appropriated", label: "Appropriated", align: "right" },
      { key: "utilized", label: "Utilized (Obligated)", align: "right" },
      { key: "percent", label: "% Utilized", align: "right" },
    ],
    rows: funds.map((f) => ({
      fund: f.fund,
      appropriated: paperOrDash(f.appropriated),
      utilized: paperOrDash(f.obligated),
      percent: pctOrDash(f.obligated, f.appropriated),
    })),
    totalsRow: {
      fund: "TOTAL",
      appropriated: paperOrDash(totals.appropriated),
      utilized: paperOrDash(totals.obligated),
      percent: pctOrDash(totals.obligated, totals.appropriated),
    },
  };
}

interface DeptTotals {
  department: string;
  appropriated: number;
  obligated: number;
}

function buildDepartmentReport(appropriations: RaaoRecord[], obligations: RaaoRecord[], filters: ReportFilters): ReportTable {
  const byDept = new Map<string, DeptTotals>();
  const ensure = (r: RaaoRecord): DeptTotals => {
    const key = r.departmentName ?? "-";
    let entry = byDept.get(key);
    if (!entry) {
      entry = { department: key, appropriated: 0, obligated: 0 };
      byDept.set(key, entry);
    }
    return entry;
  };
  for (const r of filterRecords(appropriations, filters)) ensure(r).appropriated += r.amount;
  for (const r of filterRecords(obligations, filters)) ensure(r).obligated += r.amount;
  const depts = Array.from(byDept.values()).sort((a, b) => a.department.localeCompare(b.department));

  const totals = depts.reduce(
    (acc, d) => ({ appropriated: acc.appropriated + d.appropriated, obligated: acc.obligated + d.obligated }),
    { appropriated: 0, obligated: 0 }
  );

  return {
    title: "Utilization by Department",
    columns: [
      { key: "department", label: "Department", align: "left" },
      { key: "appropriated", label: "Appropriated", align: "right" },
      { key: "obligated", label: "Obligated", align: "right" },
      { key: "balance", label: "Balance", align: "right" },
      { key: "utilized", label: "% Utilized", align: "right" },
    ],
    rows: depts.map((d) => ({
      department: d.department,
      appropriated: paperOrDash(d.appropriated),
      obligated: paperOrDash(d.obligated),
      balance: paperOrDash(d.appropriated - d.obligated),
      utilized: pctOrDash(d.obligated, d.appropriated),
    })),
    totalsRow: {
      department: "TOTAL",
      appropriated: paperOrDash(totals.appropriated),
      obligated: paperOrDash(totals.obligated),
      balance: paperOrDash(totals.appropriated - totals.obligated),
      utilized: pctOrDash(totals.obligated, totals.appropriated),
    },
  };
}

function buildAnomalySummary(alerts: AnomalyAlert[], filters: ReportFilters): ReportTable[] {
  const filtered = alerts.filter((a) => inRange(a.detectedAt, filters.from, filters.to));

  const bySeverity = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const a of filtered) {
    bySeverity.set(a.severity, (bySeverity.get(a.severity) ?? 0) + 1);
    byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
  }

  const severityTable: ReportTable = {
    title: "Alerts by Severity",
    columns: [
      { key: "severity", label: "Severity", align: "left" },
      { key: "count", label: "Count", align: "right" },
    ],
    rows: Array.from(bySeverity.entries()).map(([severity, count]) => ({ severity, count: String(count) })),
    totalsRow: { severity: "TOTAL", count: String(filtered.length) },
  };

  const statusTable: ReportTable = {
    title: "Alerts by Status",
    columns: [
      { key: "status", label: "Status", align: "left" },
      { key: "count", label: "Count", align: "right" },
    ],
    rows: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count: String(count) })),
    totalsRow: { status: "TOTAL", count: String(filtered.length) },
  };

  const listTable: ReportTable = {
    title: "Filtered Alerts",
    columns: [
      { key: "ref", label: "Alert Ref", align: "left" },
      { key: "type", label: "Type", align: "left" },
      { key: "department", label: "Department", align: "left" },
      { key: "severity", label: "Severity", align: "left" },
      { key: "status", label: "Status", align: "left" },
      { key: "confidence", label: "Confidence", align: "right" },
      { key: "date", label: "Detected", align: "right" },
    ],
    rows: filtered.map((a) => ({
      ref: a.alertRef,
      type: a.alertType,
      department: a.department ?? "-",
      severity: a.severity,
      status: a.status,
      confidence: `${a.confidence}%`,
      date: a.detectedAt,
    })),
  };

  return [severityTable, statusTable, listTable];
}

/**
 * There is no Audit Trail report. `audit_log` is admin-only by RLS
 * (20260806090520_dashboard_tracking.sql) while this page is personnel-only, so the report could
 * never return a row — it printed "No records match the selected filters." for every user and every
 * date range. Admins read the log at /admin/audit.
 */
export function generateReport(
  raw: ReportRawData,
  filters: ReportFilters,
  fiscalYearLabel: string
): GeneratedReport {
  const typeMeta = REPORT_TYPES.find((t) => t.value === filters.type)!;
  const fundLabel =
    filters.fund === "All" ? "All Funds" : (raw.fundClassifications.find((f) => f.shortCode === filters.fund)?.name ?? filters.fund);

  const base = {
    type: filters.type,
    typeLabel: typeMeta.label,
    fundLabel,
    fiscalYearLabel,
    from: filters.from,
    to: filters.to,
    generatedAt: new Date().toISOString(),
    truncated: raw.truncated,
  };

  switch (filters.type) {
    case "fund_status":
      return { ...base, tables: [buildFundStatusReport(raw.appropriations, raw.allotments, raw.obligations, filters)] };
    case "department_saao":
      return { ...base, tables: buildDepartmentSaaoReports(raw.appropriations, raw.allotments, raw.obligations, filters) };
    case "fund_utilization":
      return { ...base, tables: [buildFundUtilizationReport(raw.appropriations, raw.allotments, raw.obligations, filters)] };
    case "department":
      return { ...base, tables: [buildDepartmentReport(raw.appropriations, raw.obligations, filters)] };
    case "anomaly":
      return { ...base, tables: buildAnomalySummary(raw.alerts, filters) };
  }
}
