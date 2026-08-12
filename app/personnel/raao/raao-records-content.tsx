"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/app/components/layout/icons";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { Modal } from "@/app/components/ui/modal";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { formatPeso } from "@/app/lib/budget/format";
import type { RaaoRecord, RaaoTab, RecordStatus, Department, ObligationOption } from "@/app/lib/raao/records";
import type { FundClassification } from "@/app/lib/config/funds";
import {
  createAppropriationAction,
  createAllotmentAction,
  createObligationAction,
  createLiquidationAction,
  updateRecordFieldsAction,
  updateRecordStatusAction,
  type RaaoFormState,
} from "./actions";

const TABS: { key: RaaoTab; label: string; singular: string }[] = [
  { key: "appropriations", label: "Appropriations", singular: "Appropriation" },
  { key: "allotments", label: "Allotments", singular: "Allotment" },
  { key: "obligations", label: "Obligations (ORS)", singular: "Obligation" },
  { key: "liquidations", label: "Liquidations", singular: "Liquidation" },
];

const CREATE_ACTIONS: Record<RaaoTab, (prevState: RaaoFormState, formData: FormData) => Promise<RaaoFormState>> = {
  appropriations: createAppropriationAction,
  allotments: createAllotmentAction,
  obligations: createObligationAction,
  liquidations: createLiquidationAction,
};

function statusVariant(status: RecordStatus): "green" | "yellow" | "blue" | "gray" {
  if (status === "posted") return "green";
  if (status === "pending") return "yellow";
  if (status === "certified") return "blue";
  return "gray";
}

function statusLabel(status: RecordStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** pending → certified → posted; obligations are created already certified, so they skip pending. */
function nextStatusOption(record: RaaoRecord, tab: RaaoTab): { value: RecordStatus; label: string } | null {
  if (tab === "obligations") {
    return record.status === "certified" ? { value: "posted", label: "Posted" } : null;
  }
  if (record.status === "pending") return { value: "certified", label: "Certified" };
  if (record.status === "certified") return { value: "posted", label: "Posted" };
  return null;
}

type ModalState =
  | { kind: "create" }
  | { kind: "view"; record: RaaoRecord }
  | { kind: "edit"; record: RaaoRecord }
  | null;

export function RaaoRecordsContent({
  initialData,
  departments,
  obligationOptions,
  fundClassifications,
}: {
  initialData: Record<RaaoTab, RaaoRecord[]>;
  departments: Department[];
  obligationOptions: ObligationOption[];
  fundClassifications: FundClassification[];
}) {
  const [activeTab, setActiveTab] = useState<RaaoTab>("appropriations");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedObligationId, setSelectedObligationId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const tab = TABS.find((t) => t.key === activeTab)!;

  function switchTab(key: RaaoTab) {
    setActiveTab(key);
    setSearch("");
  }

  function closeModal() {
    setModal(null);
    setSelectedObligationId("");
    setError(undefined);
  }

  const rows = initialData[activeTab];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.ref.toLowerCase().includes(term) || r.description.toLowerCase().includes(term));
  }, [rows, search]);

  function handleCreateSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await CREATE_ACTIONS[activeTab]({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      closeModal();
      if (result.warning) setBanner(result.warning);
    });
  }

  function handleEditSubmit(formData: FormData) {
    const record = modal?.kind === "edit" ? modal.record : null;
    if (!record) return;

    startTransition(async () => {
      const fieldsResult = await updateRecordFieldsAction({}, formData);
      if (fieldsResult.error) {
        setError(fieldsResult.error);
        return;
      }

      const requestedStatus = String(formData.get("requestedStatus") ?? "");
      if (requestedStatus && requestedStatus !== record.status) {
        const statusForm = new FormData();
        statusForm.set("tab", activeTab);
        statusForm.set("id", record.id);
        statusForm.set("requestedStatus", requestedStatus);
        const statusResult = await updateRecordStatusAction({}, statusForm);
        if (statusResult.error) {
          setError(statusResult.error);
          return;
        }
      }
      closeModal();
    });
  }

  const selectedObligation = obligationOptions.find((o) => o.id === selectedObligationId);

  return (
    <SectionCard>
      <div className="flex justify-between items-center mb-3.5">
        <SectionTitle>RAAO Record Management</SectionTitle>
        <Btn icon={<Icon name="plus" className="w-3.5 h-3.5" />} small onClick={() => setModal({ kind: "create" })}>
          New Entry
        </Btn>
      </div>

      {banner && (
        <div className="mb-3.5 px-3 py-2 bg-amber-100 rounded-md text-xs text-amber-800 border border-amber-200 flex justify-between items-center gap-3">
          {banner}
          <button type="button" onClick={() => setBanner(undefined)} className="text-amber-800 font-semibold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-5 border-b border-[#D1D9E6] mb-3.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`pb-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === t.key ? "text-[#1F3864] border-[#1F3864]" : "text-[#6B7A99] border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mb-3.5 max-w-[320px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA8BE] pointer-events-none">
          <Icon name="search" className="w-3.5 h-3.5" />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab.label.toLowerCase()}…`}
          className="w-full pl-8 pr-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors"
        />
      </div>

      <TableContainer>
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              {["Reference No.", "Fund Classification", "Description", "Amount", "Date", "Status", "Actions"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3.5 py-6 text-xs text-[#6B7A99] text-center">
                  No {tab.label.toLowerCase()} match your search.
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr key={record.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-3.5 py-2.5 font-mono font-bold text-[#1F3864]">{record.ref}</td>
                  <td className="px-3.5 py-2.5">
                    {record.fundShortCode ? (
                      <Badge label={record.fundShortCode} variant="blue" />
                    ) : (
                      <span className="text-[#9BA8BE]">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-[#1A2033]">{record.description}</td>
                  <td className="px-3.5 py-2.5 font-mono font-bold text-[#1A2033]">{formatPeso(record.amount)}</td>
                  <td className="px-3.5 py-2.5 font-mono text-[#6B7A99]">{record.recordDate}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={statusLabel(record.status)} variant={statusVariant(record.status)} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1.5">
                      <Btn
                        variant="ghost"
                        small
                        icon={<Icon name="eye" className="w-3.5 h-3.5" />}
                        onClick={() => setModal({ kind: "view", record })}
                      >
                        View
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        icon={<Icon name="edit" className="w-3.5 h-3.5" />}
                        onClick={() => setModal({ kind: "edit", record })}
                      >
                        Edit
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>

      {modal?.kind === "create" && (
        <Modal title={`New ${tab.singular} Entry`} onClose={closeModal}>
          <form action={handleCreateSubmit} className="flex flex-col gap-3.5">
            <Input
              label={activeTab === "obligations" ? "ORS Number" : "Reference Number"}
              name="ref"
              placeholder={activeTab === "obligations" ? "e.g. ORS-2024-0912" : "e.g. APP-2024-GF-0099"}
              required
            />

            {activeTab === "liquidations" ? (
              <>
                <Select
                  label="Obligation (ORS)"
                  name="obligationId"
                  required
                  defaultValue=""
                  onChange={setSelectedObligationId}
                  options={[
                    { value: "", label: "Select an obligation…" },
                    ...obligationOptions.map((o) => ({ value: o.id, label: o.ref })),
                  ]}
                />
                {selectedObligation && (
                  <div className="text-xs text-[#6B7A99] -mt-2">
                    Fund: <span className="font-medium text-[#1A2033]">{selectedObligation.fundShortCode}</span> ·
                    {" "}Department: <span className="font-medium text-[#1A2033]">{selectedObligation.departmentName}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <Select
                  label="Fund Classification"
                  name="fundId"
                  required
                  options={fundClassifications.map((f) => ({ value: f.id, label: `${f.name} (${f.shortCode})` }))}
                />
                <Select
                  label="Department"
                  name="departmentId"
                  required
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                />
              </>
            )}

            <Input label="Description" name="description" placeholder="Purpose of this entry" required />
            <Input label="Amount (₱)" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
            <Input label="Date" name="recordDate" type="date" required />

            {activeTab === "obligations" && (
              <>
                <Input label="Payee / Supplier" name="payee" placeholder="e.g. ABC Construction Supplies" required />
                <Input
                  label="Supporting Document"
                  name="attachment"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                />
              </>
            )}

            {error && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
            )}

            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : activeTab === "obligations" ? "Submit & Certify" : "Save Entry"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === "view" && (
        <Modal title={`${tab.singular} Details`} onClose={closeModal}>
          <dl className="flex flex-col gap-2.5 text-[13px]">
            <ViewField label="Reference No." value={modal.record.ref} mono />
            {modal.record.fundName && (
              <ViewField label="Fund Classification" value={`${modal.record.fundName} (${modal.record.fundShortCode})`} />
            )}
            {modal.record.departmentName && <ViewField label="Department" value={modal.record.departmentName} />}
            {modal.record.obligationRef && <ViewField label="Obligation (ORS)" value={modal.record.obligationRef} mono />}
            <ViewField label="Description" value={modal.record.description} />
            <ViewField label="Amount" value={formatPeso(modal.record.amount)} mono />
            <ViewField label="Date" value={modal.record.recordDate} mono />
            <ViewField label="Status" value={statusLabel(modal.record.status)} />
            {modal.record.payee && <ViewField label="Payee / Supplier" value={modal.record.payee} />}
            {modal.record.attachmentPath && (
              <div className="flex justify-between gap-4">
                <span className="text-xs font-semibold text-gray-700">Supporting Document</span>
                <a
                  href={`/personnel/raao/download/${modal.record.id}`}
                  className="text-xs font-medium text-[#2E74B5] hover:underline"
                >
                  Download
                </a>
              </div>
            )}
          </dl>
          <div className="flex justify-end mt-4">
            <Btn variant="ghost" onClick={closeModal}>
              Close
            </Btn>
          </div>
        </Modal>
      )}

      {modal?.kind === "edit" && (
        <Modal title={`Edit ${tab.singular}`} onClose={closeModal}>
          <form action={handleEditSubmit} className="flex flex-col gap-3.5">
            <input type="hidden" name="tab" value={activeTab} />
            <input type="hidden" name="id" value={modal.record.id} />
            <Input label="Description" name="description" defaultValue={modal.record.description} required />
            <Input
              label="Amount (₱)"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(modal.record.amount)}
              required
            />
            <Input label="Date" name="recordDate" type="date" defaultValue={modal.record.recordDate} required />
            {activeTab === "obligations" && (
              <Input label="Payee / Supplier" name="payee" defaultValue={modal.record.payee ?? ""} required />
            )}

            {(() => {
              const next = nextStatusOption(modal.record, activeTab);
              if (!next) return null;
              return (
                <Select
                  label="Status"
                  name="requestedStatus"
                  defaultValue=""
                  options={[
                    { value: "", label: `Keep as ${statusLabel(modal.record.status)}` },
                    { value: next.value, label: `Mark as ${next.label}` },
                  ]}
                />
              );
            })()}

            {error && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
            )}

            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save Changes"}
              </Btn>
            </div>
          </form>
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
