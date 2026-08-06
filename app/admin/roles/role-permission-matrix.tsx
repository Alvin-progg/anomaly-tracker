"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Toggle } from "@/app/components/ui/toggle";
import { updateModulePermissionAction } from "./actions";
import { PERSONNEL_MODULES, ADMIN_ONLY_MODULES, type PersonnelModule } from "@/app/lib/permissions/modules";

const MODULE_ROWS: { slug: string; label: string; toggleable: boolean }[] = [
  { slug: "login", label: PERSONNEL_MODULES.login, toggleable: true },
  { slug: "dashboard", label: PERSONNEL_MODULES.dashboard, toggleable: true },
  ...Object.entries(ADMIN_ONLY_MODULES).map(([slug, label]) => ({ slug, label, toggleable: false })),
  { slug: "raao_records", label: PERSONNEL_MODULES.raao_records, toggleable: true },
  { slug: "budget_monitoring", label: PERSONNEL_MODULES.budget_monitoring, toggleable: true },
  { slug: "ai_alerts", label: PERSONNEL_MODULES.ai_alerts, toggleable: true },
  { slug: "document_creation", label: PERSONNEL_MODULES.document_creation, toggleable: true },
  { slug: "reports", label: PERSONNEL_MODULES.reports, toggleable: true },
  { slug: "archives", label: PERSONNEL_MODULES.archives, toggleable: true },
];

export function RolePermissionMatrix({ permissions }: { permissions: Record<string, boolean> }) {
  const [state, setState] = useState(permissions);
  const [pendingModule, setPendingModule] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  function toggle(slug: string) {
    const targetModule = slug as PersonnelModule;
    const next = !state[slug];
    setPendingModule(slug);
    setError(undefined);
    startTransition(async () => {
      const result = await updateModulePermissionAction(targetModule, next);
      if (result.error) {
        setError(result.error);
      } else {
        setState((prev) => ({ ...prev, [slug]: next }));
      }
      setPendingModule(null);
    });
  }

  return (
    <SectionCard>
      <SectionTitle>Role & Permission Matrix</SectionTitle>
      <div className="text-xs text-[#6B7A99] mb-4">
        Configure module access for each system role. Administrator permissions cannot be revoked.
      </div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
      )}
      <TableContainer>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#1F3864]">
              <th className="px-4 py-2.5 text-left text-white/85 font-semibold text-xs">Module</th>
              <th className="px-4 py-2.5 text-center text-white/85 font-semibold text-xs">System Administrator</th>
              <th className="px-4 py-2.5 text-center text-white/85 font-semibold text-xs">Budget Personnel</th>
            </tr>
          </thead>
          <tbody>
            {MODULE_ROWS.map((row, i) => (
              <tr key={row.slug} className={`border-b border-[#F1F5F9] ${i % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}>
                <td className="px-4 py-2.5 text-[#1A2033] font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-center">
                  <Toggle checked disabled />
                </td>
                <td className="px-4 py-2.5 text-center">
                  {row.toggleable ? (
                    <Toggle
                      checked={state[row.slug] ?? true}
                      disabled={pendingModule === row.slug}
                      onChange={() => toggle(row.slug)}
                    />
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Restricted</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableContainer>
    </SectionCard>
  );
}
