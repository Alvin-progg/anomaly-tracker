import { Icon } from "@/app/components/layout/icons";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { ConfidenceBar } from "@/app/components/ui/confidence-bar";
import type { AnomalyAlert } from "@/app/lib/budget/dashboard";
import type { AlertStatus } from "@/app/lib/alerts/alerts";

type ResolutionStatus = Exclude<AlertStatus, "Pending">;

const RESOLUTION_BADGE: Record<ResolutionStatus, "red" | "green" | "yellow"> = {
  "Valid Anomaly": "red",
  "False Positive": "green",
  "Needs Further Verification": "yellow",
};

export interface ExplanationState {
  loading: boolean;
  text?: string;
  error?: string;
}

export function AlertCard({
  alert,
  busy,
  explanation,
  onResolve,
  onExplain,
}: {
  alert: AnomalyAlert;
  busy: boolean;
  explanation?: ExplanationState;
  onResolve: (status: ResolutionStatus) => void;
  onExplain: () => void;
}) {
  const resolved = alert.status !== "Pending";
  const high = alert.severity === "High";
  const confidenceColor = alert.confidence >= 85 ? "#DC2626" : alert.confidence >= 70 ? "#D97706" : "#6B7A99";
  const borderColor = resolved ? "#D1D9E6" : high ? "#FECACA" : "#FDE68A";

  return (
    <div
      className={`bg-white border rounded-lg px-5 py-4.5 ${resolved ? "opacity-70" : ""}`}
      style={{ borderColor }}
    >
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex gap-2.5 items-center">
          <span className={high ? "text-[#DC2626]" : "text-[#D97706]"}>
            <Icon name="alert" />
          </span>
          <div>
            <div className="text-sm font-bold text-[#1A2033]">{alert.alertType}</div>
            <div className="text-[11px] text-[#6B7A99] mt-0.5">
              {alert.alertRef} · {alert.detectedAt} · {alert.department ?? "Unknown department"}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Badge label={alert.severity} variant={high ? "red" : "yellow"} />
          {resolved && (
            <Badge label={alert.status} variant={RESOLUTION_BADGE[alert.status as ResolutionStatus]} />
          )}
        </div>
      </div>

      <div className="flex gap-4 items-center mb-3">
        <div>
          <span className="text-[11px] text-[#6B7A99]">Affected Record </span>
          <span className="font-mono text-xs font-bold text-[#1F3864]">{alert.recordRef}</span>
        </div>
        <div>
          <span className="text-[11px] text-[#6B7A99]">AI Confidence </span>
          <span className="font-mono text-xs font-bold" style={{ color: confidenceColor }}>
            {alert.confidence}%
          </span>
        </div>
      </div>

      <div className="mb-3">
        <ConfidenceBar value={alert.confidence} />
      </div>

      <div className="text-[13px] text-[#374151] leading-relaxed bg-[#F8FAFC] border border-[#E8ECF1] rounded-md px-3 py-2.5 mb-3.5">
        {alert.description}
      </div>

      {explanation && (
        <div className="text-[13px] text-[#1E3A5F] leading-relaxed bg-[#EFF6FF] border border-[#BFDBFE] rounded-md px-3 py-2.5 mb-3.5">
          {explanation.loading ? "Generating AI explanation…" : explanation.error ? explanation.error : explanation.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {!resolved && (
          <>
            <Btn variant="danger" small disabled={busy} onClick={() => onResolve("Valid Anomaly")}>
              Mark as Valid Anomaly
            </Btn>
            <Btn variant="ghost" small disabled={busy} onClick={() => onResolve("False Positive")}>
              False Positive
            </Btn>
            <Btn variant="secondary" small disabled={busy} onClick={() => onResolve("Needs Further Verification")}>
              Needs Further Verification
            </Btn>
          </>
        )}
        <Btn variant="ghost" small disabled={explanation?.loading} onClick={onExplain}>
          Get AI Explanation
        </Btn>
      </div>
    </div>
  );
}
