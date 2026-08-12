import { Icon } from "@/app/components/layout/icons";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { formatBytes, formatEncryption, formatTimestamp, titleCase } from "./format";
import type { BackupRecord } from "@/app/lib/backup/backups";

const COLUMNS = ["Backup ID", "Date & Time", "Size", "Type", "Encryption", "Status", "Action"];

function typeVariant(type: BackupRecord["type"]) {
  if (type === "manual") return "blue" as const;
  if (type === "safety") return "yellow" as const;
  return "gray" as const;
}

function statusVariant(status: BackupRecord["status"]) {
  if (status === "success") return "green" as const;
  if (status === "running") return "yellow" as const;
  return "red" as const;
}

export function BackupHistoryTable({ backups }: { backups: BackupRecord[] }) {
  return (
    <SectionCard>
      <SectionTitle>Backup History</SectionTitle>

      <TableContainer>
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              {COLUMNS.map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3.5 py-6 text-xs text-[#6B7A99] text-center">
                  No backups recorded yet.
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-3.5 py-2.5 font-mono text-xs font-semibold text-[#1F3864]">{b.backupRef}</td>
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#6B7A99]">
                    {formatTimestamp(b.completedAt ?? b.createdAt)}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-xs">
                    {b.status === "success" ? formatBytes(b.sizeBytes) : "—"}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={titleCase(b.type)} variant={typeVariant(b.type)} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge
                      label={formatEncryption(b.encryption)}
                      variant={b.encryption === "none" ? "gray" : "green"}
                    />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={titleCase(b.status)} variant={statusVariant(b.status)} />
                    {b.error && <div className="text-[11px] text-[#991B1B] mt-1 max-w-xs">{b.error}</div>}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {b.status === "success" && (
                      <Btn
                        variant="ghost"
                        small
                        icon={<Icon name="download" className="w-3.5 h-3.5" />}
                        href={`/admin/backup/download/${b.backupRef}`}
                      >
                        Download
                      </Btn>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>
    </SectionCard>
  );
}
