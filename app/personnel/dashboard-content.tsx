import { Icon, type IconName } from "@/app/components/layout/icons";
import { KpiCard } from "@/app/components/ui/kpi-card";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { UtilizationBarChart } from "@/app/components/charts/utilization-bar-chart";
import { FundDonutChart } from "@/app/components/charts/fund-donut-chart";
import { getAccessToken } from "@/app/lib/auth/session";
import {
  getBudgetSummary,
  getDepartmentUtilization,
  getFundDistribution,
  getPendingAlerts,
} from "@/app/lib/budget/dashboard";
import { formatPesoCompact, percentOf } from "@/app/lib/budget/format";

/** The quick panel is a pointer to /personnel/alerts, not a second review queue. */
const ALERT_PREVIEW_COUNT = 3;

export async function PersonnelDashboardContent() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return <p className="text-sm text-[#6B7A99]">Session expired. Sign in again to load the dashboard.</p>;
  }

  const [summary, byDepartment, byFund, alerts] = await Promise.all([
    getBudgetSummary(accessToken),
    getDepartmentUtilization(accessToken),
    getFundDistribution(accessToken),
    getPendingAlerts(accessToken, ALERT_PREVIEW_COUNT),
  ]);

  const fiscalYear = summary?.fiscalYear ?? "No active fiscal year";
  const appropriations = summary?.totalAppropriations ?? 0;
  const allotments = summary?.totalAllotments ?? 0;
  const obligations = summary?.totalObligations ?? 0;
  const remaining = summary?.remainingBalance ?? 0;

  const releasedShare = percentOf(allotments, appropriations);
  const obligatedShare = percentOf(obligations, allotments);

  const kpis: { label: string; value: string; sub: string; icon: IconName }[] = [
    {
      label: "Total Appropriations",
      value: formatPesoCompact(appropriations),
      sub: `${fiscalYear} – All Funds`,
      icon: "file",
    },
    {
      label: "Allotments Released",
      value: formatPesoCompact(allotments),
      sub: releasedShare ? `${releasedShare} of appropriations` : "No appropriations recorded",
      icon: "report",
    },
    {
      label: "Total Obligations",
      value: formatPesoCompact(obligations),
      sub: obligatedShare ? `${obligatedShare} of allotments` : "No allotments released",
      icon: "monitoring",
    },
    {
      label: "Remaining Balance",
      value: formatPesoCompact(remaining),
      sub: "Unobligated allotments",
      icon: "activity",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3.5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} icon={<Icon name={kpi.icon} />} />
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4">
        <SectionCard>
          <SectionTitle>Utilization by Department ({fiscalYear} Q1–Q3)</SectionTitle>
          <UtilizationBarChart data={byDepartment} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Fund Distribution</SectionTitle>
          <FundDonutChart data={byFund} />
        </SectionCard>
      </div>

      <SectionCard>
        <div className="flex justify-between items-center mb-3.5">
          <SectionTitle>AI Anomaly Alerts — Recent</SectionTitle>
          <div className="flex items-center gap-2.5 -mt-2.5">
            {alerts.pendingCount > 0 && <Badge label={`${alerts.pendingCount} Pending`} variant="red" />}
            <Btn variant="ghost" small href="/personnel/alerts">
              Review All
            </Btn>
          </div>
        </div>

        {alerts.alerts.length === 0 ? (
          <div className="text-xs text-[#6B7A99]">No pending anomaly alerts. Nothing needs review right now.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {alerts.alerts.map((alert) => {
              const high = alert.severity === "High";
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-3.5 py-3 rounded-lg border ${
                    high ? "bg-[#FFF5F5] border-[#FECACA]" : "bg-[#FFFBEB] border-[#FDE68A]"
                  }`}
                >
                  <div className={`pt-px shrink-0 ${high ? "text-[#DC2626]" : "text-[#D97706]"}`}>
                    <Icon name="alert" />
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-[13px] font-bold text-[#1A2033]">{alert.alertType}</span>
                      <Badge label={alert.severity} variant={high ? "red" : "yellow"} />
                      <span className="font-mono text-[11px] text-[#6B7A99]">{alert.recordRef}</span>
                    </div>
                    <div className="text-xs text-[#6B7A99]">{alert.description}</div>
                    {alert.department && (
                      <div className="text-[11px] text-[#9BA8BE] mt-0.5">{alert.department}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-[#6B7A99] whitespace-nowrap mt-0.5">AI {alert.confidence}%</div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
