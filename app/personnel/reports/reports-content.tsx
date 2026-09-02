"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { Icon } from "@/app/components/layout/icons";
import { MUNICIPALITY, PaperSheet, cell, cellHead } from "@/app/components/ui/paper";
import { ALL_FISCAL_YEARS, REPORT_TYPES, generateReport } from "@/app/lib/reports/aggregate";
import type { ReportColumn, ReportRawData, ReportTable, ReportType, GeneratedReport } from "@/app/lib/reports/aggregate";
import type { FundClassification } from "@/app/lib/config/funds";
import type { FiscalYear } from "@/app/lib/config/fiscal-years";

const fieldClass =
  "px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors bg-white w-full disabled:bg-[#F8FAFC] disabled:text-[#9BA8BE]";

/**
 * Local time, matching the wall clock of whoever is reading the sheet. The filename uses the same
 * derivation rather than slicing the UTC ISO string, which used to disagree with this before 08:00
 * in Manila.
 */
function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${localDay(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function align(column: ReportColumn): React.CSSProperties {
  return { ...cell, textAlign: column.align === "right" ? "right" : "left" };
}

/**
 * One header row normally; two when any column declares a `group`, so the SAAO report can print
 * `Balance` spanning `Allotment` and `Appropriations` the way the filed sheet does.
 *
 * `colSpan` counts only the *contiguous* run — counting every column that shares the group name
 * would over-span if the same name ever appeared in two separate runs. Grouped columns must sit to
 * the right of ungrouped ones, since row two fills the leftmost free slots.
 */
function TableHead({ columns }: { columns: ReportColumn[] }) {
  if (!columns.some((column) => column.group)) {
    return (
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} style={cellHead}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
    );
  }

  const top: React.ReactNode[] = [];
  const bottom: React.ReactNode[] = [];

  for (let i = 0; i < columns.length; i += 1) {
    const column = columns[i];
    if (!column.group) {
      top.push(
        <th key={column.key} style={cellHead} rowSpan={2}>
          {column.label}
        </th>
      );
      continue;
    }
    let end = i;
    while (end + 1 < columns.length && columns[end + 1].group === column.group) end += 1;
    top.push(
      <th key={column.key} style={cellHead} colSpan={end - i + 1}>
        {column.group}
      </th>
    );
    for (let j = i; j <= end; j += 1) {
      bottom.push(
        <th key={columns[j].key} style={cellHead}>
          {columns[j].label}
        </th>
      );
    }
    i = end;
  }

  return (
    <thead>
      <tr>{top}</tr>
      <tr>{bottom}</tr>
    </thead>
  );
}

function ReportTableBlock({ table }: { table: ReportTable }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 11 }}>{table.title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <TableHead columns={table.columns} />
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <td colSpan={table.columns.length} style={{ ...cell, textAlign: "center" }}>
                No records match the selected filters.
              </td>
            </tr>
          ) : (
            table.rows.map((row, i) => (
              <tr key={i}>
                {table.columns.map((column) => (
                  <td key={column.key} style={align(column)}>
                    {row[column.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))
          )}
          {table.totalsRow && (
            <tr style={{ fontWeight: 700 }}>
              {table.columns.map((column) => (
                <td key={column.key} style={align(column)}>
                  {table.totalsRow?.[column.key] ?? ""}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsContent({
  raw,
  fundClassifications,
  fiscalYears,
  activeFiscalYearId,
}: {
  raw: ReportRawData;
  fundClassifications: FundClassification[];
  fiscalYears: FiscalYear[];
  activeFiscalYearId: string | null;
}) {
  const [type, setType] = useState<ReportType>("fund_status");
  const [fiscalYearId, setFiscalYearId] = useState(activeFiscalYearId ?? ALL_FISCAL_YEARS);
  const [fund, setFund] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const typeMeta = REPORT_TYPES.find((t) => t.value === type);
  const usesFund = typeMeta?.usesFund ?? true;
  const usesFiscalYear = typeMeta?.usesFiscalYear ?? true;

  /**
   * Any filter change invalidates the preview. Leaving the old one on screen meant the Download
   * button shipped a report that no longer matched the visible filters, under a filename derived
   * from the stale type.
   */
  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setReport(null);
      setExportError(null);
      setter(value);
    };
  }

  function handleTypeChange(next: ReportType) {
    setReport(null);
    setExportError(null);
    setType(next);
    if (!(REPORT_TYPES.find((t) => t.value === next)?.usesFund ?? true)) setFund("All");
  }

  function handleGenerate() {
    const label =
      fiscalYearId === ALL_FISCAL_YEARS || !usesFiscalYear
        ? "All fiscal years"
        : (fiscalYears.find((y) => y.id === fiscalYearId)?.label ?? fiscalYearId);
    setExportError(null);
    setReport(
      generateReport(raw, { type, fiscalYearId: usesFiscalYear ? fiscalYearId : ALL_FISCAL_YEARS, fund, from, to }, label)
    );
  }

  async function handleDownloadExcel() {
    if (!report) return;
    setDownloading(true);
    setExportError(null);
    try {
      const response = await fetch("/personnel/reports/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
        // Without this an expired session follows the redirect to /login and the browser cheerfully
        // saves the login page's HTML under an .xlsx name.
        redirect: "manual",
      });
      if (response.type === "opaqueredirect" || response.status === 0) {
        setExportError("Your session expired. Sign in again, then retry the export.");
        return;
      }
      if (!response.ok) {
        setExportError(`Export failed (${response.status}). Try generating the report again.`);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.type}-report-${localDay(report.generatedAt)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[360px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Report Filters</SectionTitle>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">Report Type</label>
              <select value={type} onChange={(e) => handleTypeChange(e.target.value as ReportType)} className={`${fieldClass} cursor-pointer`}>
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">Fiscal Year</label>
              <select
                value={fiscalYearId}
                onChange={(e) => onFilterChange(setFiscalYearId)(e.target.value)}
                disabled={!usesFiscalYear}
                className={`${fieldClass} ${usesFiscalYear ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                {fiscalYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}
                    {year.status === "active" ? " (active)" : ""}
                  </option>
                ))}
                <option value={ALL_FISCAL_YEARS}>All fiscal years</option>
              </select>
              {!usesFiscalYear && (
                <span className="text-[11px] text-[#9BA8BE]">Alerts are not tied to a fiscal year.</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">Fund Classification</label>
              <select
                value={fund}
                onChange={(e) => onFilterChange(setFund)(e.target.value)}
                disabled={!usesFund}
                className={`${fieldClass} ${usesFund ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <option value="All">All Funds</option>
                {fundClassifications.map((f) => (
                  <option key={f.id} value={f.shortCode}>
                    {f.name} ({f.shortCode})
                  </option>
                ))}
              </select>
              {!usesFund && <span className="text-[11px] text-[#9BA8BE]">Not applicable to this report type.</span>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">From</label>
                <input type="date" value={from} onChange={(e) => onFilterChange(setFrom)(e.target.value)} className={fieldClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">To</label>
                <input type="date" value={to} onChange={(e) => onFilterChange(setTo)(e.target.value)} className={fieldClass} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">Export Format</label>
              <div className="flex gap-4">
                {(["pdf", "excel"] as const).map((f) => (
                  <label key={f} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} />
                    {f === "pdf" ? "PDF" : "Excel (.xlsx)"}
                  </label>
                ))}
              </div>
            </div>

            {raw.truncated && (
              <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-md px-2.5 py-2">
                More records exist than this page loaded. Totals below cover only the most recent
                {" "}
                {raw.appropriations.length + raw.allotments.length + raw.obligations.length} rows — narrow the
                fiscal year or date range before filing.
              </p>
            )}

            <Btn onClick={handleGenerate}>Generate Report</Btn>

            {report && format === "pdf" && (
              <Btn variant="secondary" icon={<Icon name="download" className="w-3.5 h-3.5" />} onClick={() => window.print()}>
                Download PDF
              </Btn>
            )}
            {report && format === "excel" && (
              <Btn variant="secondary" icon={<Icon name="download" className="w-3.5 h-3.5" />} onClick={handleDownloadExcel} disabled={downloading}>
                {downloading ? "Preparing…" : "Download Excel"}
              </Btn>
            )}
            {exportError && <p className="text-[12px] text-[#B91C1C]">{exportError}</p>}
          </div>
        </SectionCard>
      </div>

      {!report ? (
        <div>
          <div className="no-print text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">Report Preview</div>
          <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-[#D1D9E6] rounded-lg text-[#9BA8BE]">
            <Icon name="report" className="w-8 h-8 mb-2.5 opacity-40" />
            <div className="text-sm font-medium">Configure and generate a report to preview it here.</div>
          </div>
        </div>
      ) : (
        <PaperSheet label="Report Preview">
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11 }}>{MUNICIPALITY.republic}</div>
            <div style={{ fontSize: 11 }}>Province of Batangas · {MUNICIPALITY.municipality}</div>
            <div style={{ fontSize: 11 }}>Municipal Budget Office</div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>{report.typeLabel.toUpperCase()}</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>{report.fiscalYearLabel}</div>
            <div style={{ fontSize: 10 }}>
              For the period {report.from || "inception"} to {report.to || "present"}
            </div>
            <div style={{ fontSize: 10 }}>Fund: {report.fundLabel}</div>
            <div style={{ fontSize: 10 }}>Generated: {formatGeneratedAt(report.generatedAt)}</div>
            {report.truncated && (
              <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>
                PARTIAL — more records exist than were loaded; totals below are incomplete.
              </div>
            )}
          </div>

          {report.tables.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 10 }}>No records match the selected filters.</p>
          ) : (
            report.tables.map((table, i) => <ReportTableBlock key={i} table={table} />)
          )}

          <div style={{ marginTop: 24, fontSize: 10, borderTop: "1px solid #000", paddingTop: 10 }}>
            Certified correct: ________________________________ · Municipal Budget Officer
          </div>
        </PaperSheet>
      )}
    </div>
  );
}
