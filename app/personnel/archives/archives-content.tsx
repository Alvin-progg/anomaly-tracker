"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/app/components/layout/icons";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { Modal } from "@/app/components/ui/modal";
import { formatPeso } from "@/app/lib/budget/format";
import type { RaaoRecord, RaaoTab, RecordStatus } from "@/app/lib/raao/records";
import type { FundClassification } from "@/app/lib/config/funds";

export interface ArchiveRecord extends RaaoRecord {
  tab: RaaoTab;
  recordType: "Appropriation" | "Allotment" | "Obligation" | "Liquidation";
}

const TYPE_OPTIONS = ["All", "Obligation", "Allotment", "Appropriation", "Liquidation"] as const;
const STATUS_OPTIONS = ["All", "Posted", "Pending", "Certified"] as const;

/** Friendlier labels for the two abbreviated fund codes; anything else shows its raw short code. */
const FUND_LABELS: Record<string, string> = { GF: "GF", SEF: "SEF", DF: "20% Dev Fund" };

function statusVariant(status: RecordStatus): "green" | "yellow" | "blue" | "gray" {
  if (status === "posted") return "green";
  if (status === "pending") return "yellow";
  if (status === "certified") return "blue";
  return "gray";
}

function statusLabel(status: RecordStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ArchivesContent({
  records,
  fundClassifications,
}: {
  records: ArchiveRecord[];
  fundClassifications: FundClassification[];
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<(typeof TYPE_OPTIONS)[number]>("All");
  const [filterFund, setFilterFund] = useState("All");
  const [filterStatus, setFilterStatus] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [viewing, setViewing] = useState<ArchiveRecord | null>(null);

  const fundOptions = useMemo(
    () => ["All", ...new Set(fundClassifications.map((f) => f.shortCode))],
    [fundClassifications]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (term && !r.ref.toLowerCase().includes(term) && !r.description.toLowerCase().includes(term)) return false;
      if (filterType !== "All" && r.recordType !== filterType) return false;
      if (filterFund !== "All" && r.fundShortCode !== filterFund) return false;
      if (filterStatus !== "All" && statusLabel(r.status) !== filterStatus) return false;
      return true;
    });
  }, [records, search, filterType, filterFund, filterStatus]);

  return (
    <SectionCard>
      <SectionTitle>Archives & Record Search</SectionTitle>

      <div className="flex flex-wrap items-center gap-2.5 mt-3.5 mb-3.5">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA8BE] pointer-events-none">
            <Icon name="search" className="w-3.5 h-3.5" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference no. or description…"
            className="w-full pl-8 pr-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as (typeof TYPE_OPTIONS)[number])}
          className="px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none bg-white cursor-pointer"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === "All" ? "All Types" : t}
            </option>
          ))}
        </select>

        <select
          value={filterFund}
          onChange={(e) => setFilterFund(e.target.value)}
          className="px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none bg-white cursor-pointer"
        >
          {fundOptions.map((f) => (
            <option key={f} value={f}>
              {f === "All" ? "All Funds" : (FUND_LABELS[f] ?? f)}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}
          className="px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none bg-white cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Statuses" : s}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-[#6B7A99] mb-2.5">{filtered.length} records found</div>

      <TableContainer>
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              {["Reference No.", "Type", "Fund", "Description", "Amount", "Date", "Status", "Actions"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3.5 py-6 text-xs text-[#6B7A99] text-center">
                  No records match your search criteria.
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr key={`${record.tab}-${record.id}`} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-3.5 py-2.5 font-mono font-bold text-[#1F3864]">{record.ref}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={record.recordType} variant="gray" />
                  </td>
                  <td className="px-3.5 py-2.5">
                    {record.fundShortCode ? (
                      <Badge label={record.fundShortCode} variant="blue" />
                    ) : (
                      <span className="text-[#9BA8BE]">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-[#1A2033] max-w-[260px] truncate">{record.description}</td>
                  <td className="px-3.5 py-2.5 font-mono font-bold text-[#1A2033]">{formatPeso(record.amount)}</td>
                  <td className="px-3.5 py-2.5 font-mono text-[#6B7A99]">{record.recordDate}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={statusLabel(record.status)} variant={statusVariant(record.status)} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1.5">
                      <Btn variant="ghost" small icon={<Icon name="eye" className="w-3.5 h-3.5" />} onClick={() => setViewing(record)}>
                        View
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        icon={<Icon name="download" className="w-3.5 h-3.5" />}
                        href={`/personnel/archives/export/${record.tab}/${record.id}`}
                      >
                        Export
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>

      {viewing && (
        <Modal title={`${viewing.recordType} Details`} onClose={() => setViewing(null)}>
          <dl className="flex flex-col gap-2.5 text-[13px]">
            <ViewField label="Reference No." value={viewing.ref} mono />
            <ViewField label="Type" value={viewing.recordType} />
            {viewing.fundName && <ViewField label="Fund Classification" value={`${viewing.fundName} (${viewing.fundShortCode})`} />}
            {viewing.departmentName && <ViewField label="Department" value={viewing.departmentName} />}
            {viewing.obligationRef && <ViewField label="Obligation (ORS)" value={viewing.obligationRef} mono />}
            <ViewField label="Description" value={viewing.description} />
            <ViewField label="Amount" value={formatPeso(viewing.amount)} mono />
            <ViewField label="Date" value={viewing.recordDate} mono />
            <ViewField label="Status" value={statusLabel(viewing.status)} />
            {viewing.payee && <ViewField label="Payee / Supplier" value={viewing.payee} />}
            {viewing.attachmentPath && (
              <div className="flex justify-between gap-4">
                <span className="text-xs font-semibold text-gray-700">Supporting Document</span>
                <a href={`/personnel/raao/download/${viewing.id}`} className="text-xs font-medium text-[#2E74B5] hover:underline">
                  Download
                </a>
              </div>
            )}
          </dl>
          <div className="flex justify-end mt-4">
            <Btn variant="ghost" onClick={() => setViewing(null)}>
              Close
            </Btn>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}

function ViewField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <span className={`text-[#1A2033] text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
