"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { AlertCard, type ExplanationState } from "./alert-card";
import { updateAlertStatusAction, getAiExplanationAction } from "./actions";
import type { AnomalyAlert } from "@/app/lib/budget/dashboard";
import type { AlertStatus } from "@/app/lib/alerts/alerts";

type Filter = "All" | "Pending" | "Resolved";
const FILTERS: Filter[] = ["All", "Pending", "Resolved"];

export function AlertsContent({ initialData }: { initialData: AnomalyAlert[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, ExplanationState>>({});
  const [pending, startTransition] = useTransition();

  const displayed = initialData.filter((alert) => {
    if (filter === "All") return true;
    if (filter === "Pending") return alert.status === "Pending";
    return alert.status !== "Pending";
  });

  function handleResolve(alertId: string, status: Exclude<AlertStatus, "Pending">) {
    setError(undefined);
    setBusyId(alertId);
    startTransition(async () => {
      const result = await updateAlertStatusAction(alertId, status);
      if (result.error) setError(result.error);
      setBusyId(null);
    });
  }

  function handleExplain(alertId: string) {
    setExplanations((prev) => ({ ...prev, [alertId]: { loading: true } }));
    startTransition(async () => {
      const result = await getAiExplanationAction(alertId);
      setExplanations((prev) => ({
        ...prev,
        [alertId]: { loading: false, text: result.explanation, error: result.error },
      }));
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <SectionCard className="pb-3">
        <div className="flex justify-between items-center">
          <SectionTitle>AI-Assisted Anomaly Alert Review</SectionTitle>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filter === f
                    ? "bg-[#1F3864] border-[#1F3864] text-white"
                    : "bg-transparent border-[#D1D9E6] text-[#6B7A99]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {error && (
        <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
      )}

      {displayed.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          busy={pending && busyId === alert.id}
          explanation={explanations[alert.id]}
          onResolve={(status) => handleResolve(alert.id, status)}
          onExplain={() => handleExplain(alert.id)}
        />
      ))}

      {displayed.length === 0 && (
        <SectionCard>
          <div className="text-center py-8 text-[#6B7A99] text-sm">No {filter.toLowerCase()} alerts.</div>
        </SectionCard>
      )}
    </div>
  );
}
