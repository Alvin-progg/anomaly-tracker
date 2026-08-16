import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getFundClassifications } from "@/app/lib/config/funds";
import { listRecords } from "@/app/lib/raao/records";
import { listAlerts } from "@/app/lib/alerts/alerts";
import { getRecentActivity } from "@/app/lib/tracking/tracking";
import { ReportsContent } from "./reports-content";
import type { ReportRawData } from "@/app/lib/reports/aggregate";

export default async function PersonnelReportsPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const enabled = await isModuleEnabledForPersonnel("reports");
  const accessToken = await getAccessToken();

  const data =
    enabled && accessToken
      ? await Promise.all([
          listRecords(accessToken, "appropriations", { limit: 500 }),
          listRecords(accessToken, "allotments", { limit: 500 }),
          listRecords(accessToken, "obligations", { limit: 500 }),
          listAlerts(accessToken),
          getRecentActivity(accessToken, 500),
          getFundClassifications(),
        ])
      : null;

  const [appropriations, allotments, obligations, alerts, auditLog, fundClassifications] = data ?? [[], [], [], [], [], []];

  const raw: ReportRawData = { appropriations, allotments, obligations, alerts, auditLog, fundClassifications };

  return (
    <>
      <Header title="Report Generation" subtitle="Generate and export SAAO and fund utilization reports" username={session.email} />
      <main className="flex-1 p-7">
        {enabled ? (
          <ReportsContent raw={raw} fundClassifications={fundClassifications} />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
