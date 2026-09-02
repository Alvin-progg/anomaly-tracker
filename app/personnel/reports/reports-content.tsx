"use client";

import { Fragment, useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { Icon } from "@/app/components/layout/icons";
import { PaperSheet, cell, cellHead } from "@/app/components/ui/paper";
import { REPORT_TYPES, generateReport } from "@/app/lib/reports/aggregate";
import type { ReportColumn, ReportRawData, ReportTable, ReportType, GeneratedReport } from "@/app/lib/reports/aggregate";
import type { FundClassification } from "@/app/lib/config/funds";

const fieldClass =
  "px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors bg-white w-full disabled:bg-[#F8FAFC] disabled:text-[#9BA8BE]";

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function align(column: ReportColumn): React.CSSProperties {
  return { ...cell, textAlign: column.align === "right" ? "right" : "left" };
}

/**
 * One header row normally; two when any column declares a `group`, so the SAAO report can print
 * `Balance` spanning `Allotment` and `Appropriations` the way the filed sheet does. Ungrouped
 * columns span both rows.
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

  const grouped = columns.filter((column) => column.group);

  return (
    <thead>
      <tr>
        {columns.map((column, i) => {
          if (!column.group) {
            return (
              <th key={column.key} style={cellHead} rowSpan={2}>
                {column.label}
              </th>
            );
          }
          // Only the first column of each run of the same group emits the spanning cell.
          if (i > 0 && columns[i - 1].group === column.group) return null;
          const span = columns.filter((other) => other.group === column.group).length;
          return (
            <th key={column.key} style={cellHead} colSpan={span}>
              {column.group}
            </th>
          );
        })}
      </tr>
      <tr>
        {grouped.map((column) => (
          <th key={column.key} style={cellHead}>
            {column.label}
          </th>
        ))}
      </tr>
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
                    {row[column.key] ?? " "}
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

export function ReportsContent({ raw, fundClassifications }: { raw: ReportRawData; fundClassifications: FundClassification[] }) {
  const [type, setType] = useState<ReportType>("fund_status");
  const [fund, setFund] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [downloading, setDownloading] = useState(false);

  const usesFund = REPORT_TYPES.find((t) => t.value === type)?.usesFund ?? true;

  function handleTypeChange(next: ReportType) {
    setType(next);
    const nextUsesFund = REPORT_TYPES.find((t) => t.value === next)?.usesFund ?? true;
    if (!nextUsesFund) setFund("All");
  }

  function handleGenerate() {
    setReport(generateReport(raw, { type, fund, from, to }));
  }

  async function handleDownloadExcel() {
    if (!report) return;
    setDownloading(true);
    try {
      const response = await fetch("/personnel/reports/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.type}-report-${report.generatedAt.slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
              <label className="text-xs font-semibold text-gray-700">Fund Classification</label>
              <select
                value={fund}
                onChange={(e) => setFund(e.target.value)}
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
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
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
            <div style={{ fontSize: 11 }}>Republic of the Philippines</div>
            <div style={{ fontSize: 11 }}>Province of Batangas · Municipality of San Pascual</div>
            <div style={{ fontSize: 11 }}>Municipal Budget Office</div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>{report.typeLabel.toUpperCase()}</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>
              For the period {report.from || "inception"} to {report.to || "present"}
            </div>
            <div style={{ fontSize: 10 }}>Fund: {report.fundLabel}</div>
            <div style={{ fontSize: 10 }}>Generated: {formatGeneratedAt(report.generatedAt)}</div>
          </div>

          {report.tables.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 10 }}>No records match the selected filters.</p>
          ) : (
            report.tables.map((table, i) => (
              <Fragment key={i}>
                <ReportTableBlock table={table} />
              </Fragment>
            ))
          )}

          <div style={{ marginTop: 24, fontSize: 10, borderTop: "1px solid #000", paddingTop: 10 }}>
            Certified correct: ________________________________ · Municipal Budget Officer
          </div>
        </PaperSheet>
      )}
    </div>
  );
}
