"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { Icon } from "@/app/components/layout/icons";
import { REPORT_TYPES, generateReport } from "@/app/lib/reports/aggregate";
import type { ReportRawData, ReportType, GeneratedReport } from "@/app/lib/reports/aggregate";
import type { FundClassification } from "@/app/lib/config/funds";

const fieldClass =
  "px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors bg-white w-full disabled:bg-[#F8FAFC] disabled:text-[#9BA8BE]";

const cellStyle: React.CSSProperties = { border: "1px solid #1F3864", padding: "5px 8px" };
const paperFont: React.CSSProperties = { fontFamily: '"Times New Roman", Times, serif', color: "#000" };

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReportsContent({ raw, fundClassifications }: { raw: ReportRawData; fundClassifications: FundClassification[] }) {
  const [type, setType] = useState<ReportType>("saao");
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

            {report && format === "pdf" && <Btn variant="secondary" icon={<Icon name="download" className="w-3.5 h-3.5" />} onClick={() => window.print()}>Download PDF</Btn>}
            {report && format === "excel" && (
              <Btn variant="secondary" icon={<Icon name="download" className="w-3.5 h-3.5" />} onClick={handleDownloadExcel} disabled={downloading}>
                {downloading ? "Preparing…" : "Download Excel"}
              </Btn>
            )}
          </div>
        </SectionCard>
      </div>

      <div>
        <div className="no-print text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">Report Preview</div>

        {!report ? (
          <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-[#D1D9E6] rounded-lg text-[#9BA8BE]">
            <Icon name="report" className="w-8 h-8 mb-2.5 opacity-40" />
            <div className="text-sm font-medium">Configure and generate a report to preview it here.</div>
          </div>
        ) : (
          <div className="print-area bg-white border border-[#D1D9E6] rounded-lg overflow-hidden">
            <div style={{ ...paperFont, padding: "28px 32px", fontSize: 11, background: "#FFF" }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Republic of the Philippines</div>
                <div style={{ fontSize: 11 }}>Province of Batangas</div>
                <div style={{ fontSize: 11 }}>Municipality of San Pascual</div>
                <div>Municipal Budget Office</div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {report.typeLabel}
                </div>
                <div style={{ fontSize: 10, marginTop: 4 }}>
                  For the period {report.from || "inception"} to {report.to || "present"}
                </div>
                <div style={{ fontSize: 10 }}>Fund: {report.fundLabel}</div>
                <div style={{ fontSize: 10 }}>Generated: {formatGeneratedAt(report.generatedAt)}</div>
              </div>

              {report.tables.map((table) => (
                <div key={table.title} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>{table.title}</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#1F3864", color: "#FFF" }}>
                        {table.columns.map((col) => (
                          <th key={col.key} style={{ ...cellStyle, textAlign: col.align === "right" ? "right" : "left" }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.length === 0 ? (
                        <tr>
                          <td colSpan={table.columns.length} style={{ ...cellStyle, textAlign: "center", color: "#6B7A99" }}>
                            No records match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        table.rows.map((row, i) => (
                          <tr key={i}>
                            {table.columns.map((col) => (
                              <td key={col.key} style={{ ...cellStyle, textAlign: col.align === "right" ? "right" : "left" }}>
                                {row[col.key] ?? " "}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                      {table.totalsRow && (
                        <tr style={{ fontWeight: 700, background: "#F0F2F5" }}>
                          {table.columns.map((col) => (
                            <td key={col.key} style={{ ...cellStyle, textAlign: col.align === "right" ? "right" : "left" }}>
                              {table.totalsRow?.[col.key] ?? ""}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}

              <div style={{ marginTop: 24, fontSize: 10, color: "#6B7A99", borderTop: "1px solid #E8ECF1", paddingTop: 10 }}>
                Certified correct: ________________________________ · Municipal Budget Officer
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
