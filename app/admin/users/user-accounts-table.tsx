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
import { createUserAction, toggleUserStatusAction, updateUserAction, type UserFormState } from "./actions";
import type { AppRole } from "@/app/lib/auth/gotrue";

export interface DisplayUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: AppRole;
  banned: boolean;
  lastLogin: string;
}

const roleOptions = [
  { value: "personnel", label: "Budget Personnel" },
  { value: "admin", label: "System Administrator" },
];

export function UserAccountsTable({ users }: { users: DisplayUser[] }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<DisplayUser | null>(null);

  const [createError, setCreateError] = useState<string | undefined>();
  const [editError, setEditError] = useState<string | undefined>();
  const [createPending, startCreateTransition] = useTransition();
  const [editPending, startEditTransition] = useTransition();

  function closeModal() {
    setModal(null);
    setEditingUser(null);
    setCreateError(undefined);
    setEditError(undefined);
  }

  function handleCreateSubmit(formData: FormData) {
    startCreateTransition(async () => {
      const result: UserFormState = await createUserAction({}, formData);
      if (result.error) setCreateError(result.error);
      else closeModal();
    });
  }

  function handleEditSubmit(formData: FormData) {
    startEditTransition(async () => {
      const result: UserFormState = await updateUserAction({}, formData);
      if (result.error) setEditError(result.error);
      else closeModal();
    });
  }

  const filtered = users.filter(
    (u) => u.fullName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SectionCard>
      <div className="flex justify-between items-center mb-4">
        <div>
          <SectionTitle>Budget Personnel Accounts</SectionTitle>
          <div className="text-xs text-[#6B7A99] -mt-2.5">{users.length} accounts registered</div>
        </div>
        <Btn icon={<Icon name="plus" />} onClick={() => setModal("create")}>
          Add New User
        </Btn>
      </div>

      <div className="relative mb-3.5 max-w-[320px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA8BE]">
          <Icon name="search" className="w-4 h-4" />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username…"
          className="w-full pl-8 pr-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] outline-none focus:border-[#2E74B5] transition-colors"
        />
      </div>

      <TableContainer>
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
              {["Full Name", "Username", "Email", "Role", "Status", "Last Login", "Actions"].map((h) => (
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
                  No accounts found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-3.5 py-2.5 font-semibold text-[#1A2033]">{u.fullName}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs text-[#2E74B5]">{u.username}</td>
                  <td className="px-3.5 py-2.5 text-xs text-[#6B7A99]">{u.email}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={u.role === "admin" ? "Administrator" : "Personnel"} variant={u.role === "admin" ? "blue" : "gray"} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge label={u.banned ? "Inactive" : "Active"} variant={u.banned ? "gray" : "green"} />
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#6B7A99]">{u.lastLogin}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1.5">
                      <Btn
                        variant="ghost"
                        small
                        icon={<Icon name="edit" className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditingUser(u);
                          setModal("edit");
                        }}
                      >
                        Edit
                      </Btn>
                      <form action={toggleUserStatusAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="nextBanned" value={String(!u.banned)} />
                        <Btn variant="danger" small type="submit">
                          {u.banned ? "Activate" : "Deactivate"}
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
        <Modal title="Add New User Account" onClose={closeModal}>
          <form action={handleCreateSubmit} className="flex flex-col gap-3.5">
            <Input label="Full Name" name="fullName" placeholder="Juan Dela Cruz" required />
            <Input label="Username" name="username" placeholder="jdelacruz" required />
            <Input label="Temporary Password" name="password" type="password" placeholder="Set a temporary password" required />
            <Select label="Role" name="role" defaultValue="personnel" options={roleOptions} required />
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Status</label>
              <div className="flex gap-3">
                {["Active", "Inactive"].map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input type="radio" name="status" value={s} defaultChecked={s === "Active"} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            {createError && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{createError}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={createPending}>
                {createPending ? "Creating…" : "Create Account"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal === "edit" && editingUser && (
        <Modal title="Edit Account" onClose={closeModal}>
          <form action={handleEditSubmit} className="flex flex-col gap-3.5">
            <input type="hidden" name="id" value={editingUser.id} />
            <Input label="Full Name" name="fullName" defaultValue={editingUser.fullName} required />
            <div className="flex flex-col gap-1">
              <Input label="Username" name="username" defaultValue={editingUser.username} required />
              <div className="text-[11px] text-[#6B7A99]">
                This is also the account&apos;s login — changing it changes what the user signs in with.
              </div>
            </div>
            <Input label="New Password" name="password" type="password" placeholder="Leave blank to keep current password" />
            <Select label="Role" name="role" defaultValue={editingUser.role} options={roleOptions} required />
            {editError && (
              <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{editError}</div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={editPending}>
                {editPending ? "Saving…" : "Save Changes"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}
