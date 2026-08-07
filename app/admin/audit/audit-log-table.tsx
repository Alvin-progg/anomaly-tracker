"use client";

import { useMemo, useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";

export interface AuditLogEntry {
  id: string;
  email: string;
  module: string;
  action: string;
  details: string | null;
  created_at: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fieldClass =
  "px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors bg-white";

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilter, setUserFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");

  const userOptions = useMemo(
    () => ["All", ...Array.from(new Set(entries.map((e) => e.email))).sort()],
    [entries]
  );
  const actionOptions = useMemo(
    () => ["All", ...Array.from(new Set(entries.map((e) => e.action))).sort()],
    [entries]
  );

  const filtered = entries.filter((e) => {
    const day = e.created_at.slice(0, 10);
    const matchUser = userFilter === "All" || e.email === userFilter;
    const matchAction = actionFilter === "All" || e.action === actionFilter;
    const matchFrom = !dateFrom || day >= dateFrom;
    const matchTo = !dateTo || day <= dateTo;
    return matchUser && matchAction && matchFrom && matchTo;
  });

  return (
    <SectionCard>
      <SectionTitle>Full Audit Log</SectionTitle>

      <div className="flex gap-2.5 mb-3.5 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-date-from" className="text-xs font-semibold text-gray-700">
            From
          </label>
          <input
            id="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-date-to" className="text-xs font-semibold text-gray-700">
            To
          </label>
          <input
            id="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-user" className="text-xs font-semibold text-gray-700">
            User
          </label>
          <select
            id="audit-user"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className={`${fieldClass} cursor-pointer`}
          >
            {userOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-xs font-semibold text-gray-700">
            Action
          </label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className={`${fieldClass} cursor-pointer`}
          >
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs text-[#6B7A99] mb-2.5">
        Showing {filtered.length} of {entries.length} entries
      </div>

      <TableContainer>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Timestamp</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">User</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Module</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Action</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-xs text-[#6B7A99] text-center">
                  No activity recorded yet.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-xs text-[#6B7A99] text-center">
                  No entries match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#EEF2F7] last:border-0">
                  <td className="px-4 py-2.5 text-xs font-mono text-[#6B7A99]">{formatTimestamp(row.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#1A2033] font-medium">{row.email}</td>
                  <td className="px-4 py-2.5">
                    <Badge label={row.module} variant="blue" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge label={row.action} variant="gray" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6B7A99]">{row.details ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>
    </SectionCard>
  );
}
