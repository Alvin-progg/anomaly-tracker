import type { RaaoRecord } from "@/app/lib/raao/records";
import type { AnomalyAlert } from "@/app/lib/budget/dashboard";
import type { AuditLogRow } from "@/app/lib/tracking/tracking";
import type { FundClassification } from "@/app/lib/config/funds";
import { formatPeso, percentOf } from "@/app/lib/budget/format";

/**
 * Pure aggregation over already-fetched, already-authorized data — no "server-only" here on
 * purpose, this runs client-side in reports-content.tsx over the arrays page.tsx fetched once,
 * same convention as every other filter/table module in this app (Archives, RAAO Records, the
 * audit log table).
 */

export type ReportType = "saao" | "fund_utilization" | "department" | "anomaly" | "audit";

export interface ReportFilters {
  type: ReportType;
  /** "All" or a fund short code. Ignored by "anomaly"/"audit" — neither carries a fund. */
  fund: string;
  /** "" = unbounded. */
  from: string;
  to: string;
}

export const REPORT_TYPES: { value: ReportType; label: string; usesFund: boolean }[] = [
  { value: "saao", label: "SAAO Report (Status of Appropriations, Allotments & Obligations)", usesFund: true },
  { value: "fund_utilization", label: "Fund Utilization Summary", usesFund: true },
  { value: "department", label: "Utilization by Department", usesFund: true },
  { value: "anomaly", label: "AI Anomaly Alerts Summary", usesFund: false },
  { value: "audit", label: "Audit Trail Report", usesFund: false },
];

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
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
  from: string;
  to: string;
  generatedAt: string;
  tables: ReportTable[];
}

export interface ReportRawData {
  appropriations: RaaoRecord[];
  allotments: RaaoRecord[];
  obligations: RaaoRecord[];
  alerts: AnomalyAlert[];
  auditLog: AuditLogRow[];
  fundClassifications: FundClassification[];
}

function inRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function moneyOrDash(n: number): string {
  return n !== 0 ? formatPeso(n) : "—";
}

function pctOrDash(part: number, whole: number): string {
  return percentOf(part, whole) ?? "—";
}

function filterRecords(rows: RaaoRecord[], filters: ReportFilters): RaaoRecord[] {
  return rows.filter((r) => inRange(r.recordDate, filters.from, filters.to) && (filters.fund === "All" || r.fundShortCode === filters.fund));
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
    const key = r.fundShortCode ?? "—";
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

function buildSaaoReport(appropriations: RaaoRecord[], allotments: RaaoRecord[], obligations: RaaoRecord[], filters: ReportFilters): ReportTable {
  const funds = groupByFund(appropriations, allotments, obligations, filters);
  const totals = sumFundTotals(funds);
  return {
    title: "Status of Appropriations, Allotments and Obligations",
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
      appropriation: moneyOrDash(f.appropriated),
      allotment: moneyOrDash(f.allotted),
      obligation: moneyOrDash(f.obligated),
      balance: moneyOrDash(f.allotted - f.obligated),
      utilized: pctOrDash(f.obligated, f.allotted),
    })),
    totalsRow: {
      fund: "TOTAL",
      appropriation: moneyOrDash(totals.appropriated),
      allotment: moneyOrDash(totals.allotted),
      obligation: moneyOrDash(totals.obligated),
      balance: moneyOrDash(totals.allotted - totals.obligated),
      utilized: pctOrDash(totals.obligated, totals.allotted),
    },
  };
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
      appropriated: moneyOrDash(f.appropriated),
      utilized: moneyOrDash(f.obligated),
      percent: pctOrDash(f.obligated, f.appropriated),
    })),
    totalsRow: {
      fund: "TOTAL",
      appropriated: moneyOrDash(totals.appropriated),
      utilized: moneyOrDash(totals.obligated),
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
    const key = r.departmentName ?? "—";
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
      appropriated: moneyOrDash(d.appropriated),
      obligated: moneyOrDash(d.obligated),
      balance: moneyOrDash(d.appropriated - d.obligated),
      utilized: pctOrDash(d.obligated, d.appropriated),
    })),
    totalsRow: {
      department: "TOTAL",
      appropriated: moneyOrDash(totals.appropriated),
      obligated: moneyOrDash(totals.obligated),
      balance: moneyOrDash(totals.appropriated - totals.obligated),
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
      department: a.department ?? "—",
      severity: a.severity,
      status: a.status,
      confidence: `${a.confidence}%`,
      date: a.detectedAt,
    })),
  };

  return [severityTable, statusTable, listTable];
}

function buildAuditTrail(entries: AuditLogRow[], filters: ReportFilters): ReportTable[] {
  const filtered = entries.filter((e) => inRange(e.created_at.slice(0, 10), filters.from, filters.to));
  return [
    {
      title: "Audit Trail",
      columns: [
        { key: "date", label: "Date", align: "left" },
        { key: "user", label: "User", align: "left" },
        { key: "role", label: "Role", align: "left" },
        { key: "module", label: "Module", align: "left" },
        { key: "action", label: "Action", align: "left" },
        { key: "details", label: "Details", align: "left" },
      ],
      rows: filtered.map((e) => ({
        date: e.created_at.slice(0, 16).replace("T", " "),
        user: e.email,
        role: e.role,
        module: e.module,
        action: e.action,
        details: e.details ?? "—",
      })),
      totalsRow: { date: "", user: "", role: "", module: "", action: "TOTAL ENTRIES", details: String(filtered.length) },
    },
  ];
}

export function generateReport(raw: ReportRawData, filters: ReportFilters): GeneratedReport {
  const typeMeta = REPORT_TYPES.find((t) => t.value === filters.type)!;
  const fundLabel =
    filters.fund === "All" ? "All Funds" : (raw.fundClassifications.find((f) => f.shortCode === filters.fund)?.name ?? filters.fund);

  const base = {
    type: filters.type,
    typeLabel: typeMeta.label,
    fundLabel,
    from: filters.from,
    to: filters.to,
    generatedAt: new Date().toISOString(),
  };

  switch (filters.type) {
    case "saao":
      return { ...base, tables: [buildSaaoReport(raw.appropriations, raw.allotments, raw.obligations, filters)] };
    case "fund_utilization":
      return { ...base, tables: [buildFundUtilizationReport(raw.appropriations, raw.allotments, raw.obligations, filters)] };
    case "department":
      return { ...base, tables: [buildDepartmentReport(raw.appropriations, raw.obligations, filters)] };
    case "anomaly":
      return { ...base, tables: buildAnomalySummary(raw.alerts, filters) };
    case "audit":
      return { ...base, tables: buildAuditTrail(raw.auditLog, filters) };
  }
}
