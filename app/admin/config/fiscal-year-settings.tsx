"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/components/layout/icons";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { Modal } from "@/app/components/ui/modal";
import { Input } from "@/app/components/ui/input";
import { createFiscalYearAction, activateFiscalYearAction } from "./actions";
import type { FiscalYear } from "@/app/lib/config/fiscal-years";

function formatRange(startDate: string, endDate: string): string {
  const format = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${format(startDate)} – ${format(endDate)}`;
}

export function FiscalYearSettings({ fiscalYears }: { fiscalYears: FiscalYear[] }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();
  const [addPending, startAddTransition] = useTransition();

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | undefined>();
  const [, startActivateTransition] = useTransition();

  function closeAddModal() {
    setShowAddModal(false);
    setAddError(undefined);
  }

  function handleAddSubmit(formData: FormData) {
    startAddTransition(async () => {
      const result = await createFiscalYearAction({}, formData);
      if (result.error) setAddError(result.error);
      else closeAddModal();
    });
  }

  function handleActivate(id: string) {
    setActivatingId(id);
    setActivateError(undefined);
    startActivateTransition(async () => {
      const result = await activateFiscalYearAction(id);
      if (result.error) setActivateError(result.error);
      setActivatingId(null);
    });
  }

  return (
    <SectionCard>
      <div className="flex justify-between items-center mb-3.5">
        <SectionTitle>Fiscal Year Settings</SectionTitle>
        <Btn icon={<Icon name="plus" className="w-3.5 h-3.5" />} small onClick={() => setShowAddModal(true)}>
          Add New Fiscal Year
        </Btn>
      </div>

      {activateError && (
        <div className="mb-3 px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{activateError}</div>
      )}

      <div className="flex gap-3.5 flex-wrap">
        {fiscalYears.length === 0 ? (
          <div className="text-xs text-[#6B7A99]">No fiscal years configured.</div>
        ) : (
          fiscalYears.map((fy) => (
            <div
              key={fy.id}
              className={`min-w-[180px] rounded-lg px-4 py-3.5 flex flex-col gap-1.5 ${
                fy.status === "active" ? "border-2 border-[#2E74B5]" : "border border-[#E8ECF1]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#1F3864] text-[13px]">{fy.label}</span>
                <Badge label={fy.status === "active" ? "Active" : "Closed"} variant={fy.status === "active" ? "blue" : "gray"} />
              </div>
              <div className="text-[11px] text-[#6B7A99]">{formatRange(fy.startDate, fy.endDate)}</div>
              {fy.status === "closed" && (
                <Btn variant="ghost" small disabled={activatingId === fy.id} onClick={() => handleActivate(fy.id)}>
                  {activatingId === fy.id ? "Activating…" : "Activate"}
                </Btn>
              )}
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <Modal title="Add New Fiscal Year" onClose={closeAddModal}>
          <form action={handleAddSubmit} className="flex flex-col gap-3.5">
            <Input label="Fiscal Year Label" name="label" placeholder="FY 2025" required />
            <Input label="Start Date" name="startDate" type="date" required />
            <Input label="End Date" name="endDate" type="date" required />
            {addError && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{addError}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeAddModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={addPending}>
                {addPending ? "Creating…" : "Create Fiscal Year"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}
