"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { runBackupAction } from "./actions";
import { formatBytes, formatDate, formatTime, titleCase } from "./format";
import type { BackupRecord, BackupSettings } from "@/app/lib/backup/backups";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-[13px]">
      <span className="text-[#6B7A99]">{label}</span>
      <span className={`font-semibold text-[#1A2033] ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}

export function BackupStatusCard({
  settings,
  lastSuccessful,
}: {
  settings: BackupSettings;
  lastSuccessful: BackupRecord | null;
}) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleRun() {
    setError(undefined);
    startTransition(async () => {
      const result = await runBackupAction();
      if (result.error) setError(result.error);
    });
  }

  return (
    <SectionCard>
      <SectionTitle>Backup Status</SectionTitle>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3.5 mb-4">
        <div className="text-xs font-semibold text-[#065F46]">Last Successful Backup</div>
        {lastSuccessful ? (
          <>
            <div className="text-xl font-extrabold font-mono text-[#065F46] mt-1">
              {formatDate(lastSuccessful.completedAt ?? lastSuccessful.createdAt)}
            </div>
            <div className="text-xs text-[#059669] mt-0.5">
              {formatTime(lastSuccessful.completedAt ?? lastSuccessful.createdAt)} ·{" "}
              {formatBytes(lastSuccessful.sizeBytes)} · {titleCase(lastSuccessful.type)}
            </div>
          </>
        ) : (
          <div className="text-[13px] text-[#059669] mt-1">
            No successful backup yet. Run one now to establish a recovery point.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <Row label="Schedule" value={settings.scheduleLabel} />
        <Row label="Retention Period" value={`${settings.retentionDays} days`} />
        <Row label="Storage Location" value={settings.storagePath} mono />
      </div>

      {error && (
        <div className="px-3 py-2 mt-3.5 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleRun}
        disabled={pending}
        className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-[#1F3864] transition-opacity hover:opacity-85 disabled:bg-[#6B7A99] disabled:cursor-not-allowed"
      >
        {pending ? "Running Backup…" : "Run Backup Now"}
      </button>
    </SectionCard>
  );
}
