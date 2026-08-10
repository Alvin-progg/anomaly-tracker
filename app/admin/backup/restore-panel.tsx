"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { Modal } from "@/app/components/ui/modal";
import { restoreBackupAction } from "./actions";
import { formatBytes, formatDate, formatTimestamp } from "./format";
import type { BackupRecord } from "@/app/lib/backup/backups";

const fieldClass =
  "px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors bg-white w-full";

export function RestorePanel({ backups }: { backups: BackupRecord[] }) {
  const [selectedRef, setSelectedRef] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedRef, setTypedRef] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const restorable = backups.filter((b) => b.status === "success");
  const selected = restorable.find((b) => b.backupRef === selectedRef) ?? null;

  function closeConfirm() {
    setConfirmOpen(false);
    setTypedRef("");
  }

  function handleRestore() {
    setError(undefined);
    startTransition(async () => {
      // On success this action redirects to /login and never returns — the restore replaces
      // auth.users, so this session is gone.
      const result = await restoreBackupAction({ backupRef: selectedRef });
      if (result?.error) {
        setError(result.error);
        closeConfirm();
      }
    });
  }

  return (
    <SectionCard>
      <SectionTitle>Restore Options</SectionTitle>

      <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-md px-3 py-2.5 text-xs text-[#92400E] mb-3.5">
        Restoring replaces <strong>all current data</strong>, including every user account and the
        audit log. A safety backup is taken automatically first, and you will be signed out when the
        restore completes.
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="restore-backup" className="text-xs font-semibold text-gray-700">
          Select Backup to Restore
        </label>
        <select
          id="restore-backup"
          value={selectedRef}
          onChange={(e) => setSelectedRef(e.target.value)}
          disabled={restorable.length === 0}
          className={`${fieldClass} cursor-pointer disabled:bg-[#F8FAFC] disabled:text-[#6B7A99]`}
        >
          <option value="">
            {restorable.length === 0 ? "No successful backups available" : "Choose a backup…"}
          </option>
          {restorable.map((b) => (
            <option key={b.backupRef} value={b.backupRef}>
              {b.backupRef} — {formatDate(b.completedAt ?? b.createdAt)} ({formatBytes(b.sizeBytes)})
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-[#6B7A99] mt-3">
        Restoring to:{" "}
        <span className="font-mono text-[#1A2033]">
          {selected ? formatTimestamp(selected.completedAt ?? selected.createdAt) : "—"}
        </span>
      </div>
      <div className="text-xs text-[#6B7A99] mt-1">Estimated recovery time: &lt; 30 minutes</div>

      {error && (
        <div className="px-3 py-2 mt-3 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <Btn
        variant="secondary"
        className="mt-3.5"
        disabled={!selected || pending}
        onClick={() => setConfirmOpen(true)}
      >
        {pending ? "Restoring…" : "Initiate Restore"}
      </Btn>

      {confirmOpen && selected && (
        <Modal title="Confirm Database Restore" onClose={closeConfirm}>
          <div className="flex flex-col gap-3.5">
            <div className="text-[13px] text-[#1A2033]">
              This replaces the entire database with{" "}
              <span className="font-mono font-semibold">{selected.backupRef}</span>, taken{" "}
              {formatTimestamp(selected.completedAt ?? selected.createdAt)}. Every record created
              since then — including user accounts and audit entries — will be lost.
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-ref" className="text-xs font-semibold text-gray-700">
                Type <span className="font-mono">{selected.backupRef}</span> to confirm
              </label>
              <input
                id="confirm-ref"
                value={typedRef}
                onChange={(e) => setTypedRef(e.target.value)}
                autoComplete="off"
                className={`${fieldClass} font-mono`}
              />
            </div>

            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeConfirm}>
                Cancel
              </Btn>
              <Btn
                variant="danger"
                onClick={handleRestore}
                disabled={typedRef !== selected.backupRef || pending}
              >
                {pending ? "Restoring…" : "Restore Database"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}
