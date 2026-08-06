"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/components/layout/icons";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { Modal } from "@/app/components/ui/modal";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { THRESHOLD_MODULES, THRESHOLD_TYPES } from "@/app/lib/config/threshold-types";
import { createFinancialThresholdAction, updateFinancialThresholdAction } from "./actions";
import type { FinancialThreshold } from "@/app/lib/config/thresholds";

const moduleOptions = Object.entries(THRESHOLD_MODULES).map(([value, label]) => ({ value, label }));
const typeOptions = Object.entries(THRESHOLD_TYPES).map(([value, label]) => ({ value, label }));

function displayValue(threshold: FinancialThreshold): string {
  if (threshold.type === "percentage") return `${threshold.value}%`;
  if (threshold.type === "days") return `${threshold.value} days`;
  if (threshold.type === "amount") return `₱${threshold.value}`;
  return threshold.value;
}

export function FinancialThresholdsTable({ thresholds }: { thresholds: FinancialThreshold[] }) {
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<FinancialThreshold | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError(undefined);
  }

  function handleCreateSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createFinancialThresholdAction({}, formData);
      if (result.error) setError(result.error);
      else closeModal();
    });
  }

  function handleEditSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateFinancialThresholdAction({}, formData);
      if (result.error) setError(result.error);
      else closeModal();
    });
  }

  return (
    <SectionCard>
      <div className="flex justify-between items-center mb-3.5">
        <SectionTitle>Financial Thresholds</SectionTitle>
        <Btn icon={<Icon name="plus" className="w-3.5 h-3.5" />} small onClick={() => setModal("create")}>
          Add New Threshold
        </Btn>
      </div>

      <TableContainer>
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              {["Threshold Name", "Module", "Type", "Value", "Action"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {thresholds.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3.5 py-6 text-xs text-[#6B7A99] text-center">
                  No thresholds configured.
                </td>
              </tr>
            ) : (
              thresholds.map((t) => (
                <tr key={t.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-3.5 py-2.5 font-medium text-[#1A2033]">{t.name}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={THRESHOLD_MODULES[t.module]} variant="blue" />
                  </td>
                  <td className="px-3.5 py-2.5 text-xs text-[#6B7A99]">{THRESHOLD_TYPES[t.type]}</td>
                  <td className="px-3.5 py-2.5 font-mono font-bold text-[#1F3864]">{displayValue(t)}</td>
                  <td className="px-3.5 py-2.5">
                    <Btn
                      variant="ghost"
                      small
                      icon={<Icon name="edit" className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditing(t);
                        setModal("edit");
                      }}
                    >
                      Edit
                    </Btn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>

      {modal === "create" && (
        <Modal title="Add New Threshold" onClose={closeModal}>
          <form action={handleCreateSubmit} className="flex flex-col gap-3.5">
            <Input label="Threshold Name" name="name" placeholder="e.g. Expenditure Spike Alert" required />
            <Select label="Module" name="module" defaultValue="obligations" options={moduleOptions} required />
            <Select label="Type" name="type" defaultValue="percentage" options={typeOptions} required />
            <Input label="Value" name="value" placeholder="e.g. 150 (for 150%)" required />
            {error && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save Threshold"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal === "edit" && editing && (
        <Modal title="Edit Threshold" onClose={closeModal}>
          <form action={handleEditSubmit} className="flex flex-col gap-3.5">
            <input type="hidden" name="id" value={editing.id} />
            <Input label="Threshold Name" name="name" defaultValue={editing.name} required />
            <Select label="Module" name="module" defaultValue={editing.module} options={moduleOptions} required />
            <Select label="Type" name="type" defaultValue={editing.type} options={typeOptions} required />
            <Input label="Value" name="value" defaultValue={editing.value} required />
            {error && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save Threshold"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}
