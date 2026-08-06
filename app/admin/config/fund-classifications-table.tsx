"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/components/layout/icons";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { Modal } from "@/app/components/ui/modal";
import { Input } from "@/app/components/ui/input";
import {
  createFundClassificationAction,
  updateFundClassificationAction,
  toggleFundClassificationActiveAction,
} from "./actions";
import type { FundClassification } from "@/app/lib/config/funds";

export function FundClassificationsTable({ funds }: { funds: FundClassification[] }) {
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<FundClassification | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError(undefined);
  }

  function handleCreateSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createFundClassificationAction({}, formData);
      if (result.error) setError(result.error);
      else closeModal();
    });
  }

  function handleEditSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateFundClassificationAction({}, formData);
      if (result.error) setError(result.error);
      else closeModal();
    });
  }

  return (
    <SectionCard>
      <div className="flex justify-between items-center mb-3.5">
        <SectionTitle>Fund Classification Settings</SectionTitle>
        <Btn icon={<Icon name="plus" className="w-3.5 h-3.5" />} small onClick={() => setModal("create")}>
          Add New Fund Classification
        </Btn>
      </div>

      <TableContainer>
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              {["Name", "Short Code", "Status", "Action"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3.5 py-6 text-xs text-[#6B7A99] text-center">
                  No fund classifications configured.
                </td>
              </tr>
            ) : (
              funds.map((f) => (
                <tr key={f.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-3.5 py-2.5 font-medium text-[#1A2033]">{f.name}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs text-[#2E74B5]">{f.shortCode}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={f.active ? "Active" : "Inactive"} variant={f.active ? "green" : "gray"} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1.5">
                      <Btn
                        variant="ghost"
                        small
                        icon={<Icon name="edit" className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditing(f);
                          setModal("edit");
                        }}
                      >
                        Edit
                      </Btn>
                      <form action={toggleFundClassificationActiveAction}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="name" value={f.name} />
                        <input type="hidden" name="nextActive" value={String(!f.active)} />
                        <Btn variant="danger" small type="submit">
                          {f.active ? "Deactivate" : "Activate"}
                        </Btn>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>

      {modal === "create" && (
        <Modal title="Add New Fund Classification" onClose={closeModal}>
          <form action={handleCreateSubmit} className="flex flex-col gap-3.5">
            <Input label="Fund Name" name="name" placeholder="e.g. General Fund" required />
            <Input label="Short Code" name="shortCode" placeholder="e.g. GF" required />
            {error && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save Fund Classification"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal === "edit" && editing && (
        <Modal title="Edit Fund Classification" onClose={closeModal}>
          <form action={handleEditSubmit} className="flex flex-col gap-3.5">
            <input type="hidden" name="id" value={editing.id} />
            <Input label="Fund Name" name="name" defaultValue={editing.name} required />
            <Input label="Short Code" name="shortCode" defaultValue={editing.shortCode} required />
            {error && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save Fund Classification"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}
