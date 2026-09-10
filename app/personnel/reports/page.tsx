import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getFundClassifications } from "@/app/lib/config/funds";
import { getActiveFiscalYear, getFiscalYears } from "@/app/lib/config/fiscal-years";
import { listRecordsPage } from "@/app/lib/raao/records";
import { listAlerts } from "@/app/lib/alerts/alerts";
import { ReportsContent } from "./reports-content";
import type { ReportRawData } from "@/app/lib/reports/aggregate";

/**
 * Rows are fetched unscoped and filtered client-side, which is this module's documented convention
 * (see app/lib/reports/aggregate.ts) and is what lets the Fiscal Year selector switch years without
 * a round trip. `RaaoRecord.fiscalYearId` is what makes that possible.
 *
 * The cap is deliberately surfaced rather than swallowed: the query is `order=record_date.desc
 * limit=N`, so past N rows a date-ranged report would quietly total a subset. `listRecordsPage`
 * asks for N+1 and reports whether there were more.
 */
const ROW_LIMIT = 500;

export default async function PersonnelReportsPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const accessToken = await getAccessToken();

  const [enabled, fiscalYears, activeYear] = await Promise.all([
    isModuleEnabledForPersonnel("reports"),
    getFiscalYears(),
    getActiveFiscalYear(),
  ]);

  const data =
    enabled && accessToken
      ? await Promise.all([
          listRecordsPage(accessToken, "appropriations", { limit: ROW_LIMIT }),
          listRecordsPage(accessToken, "allotments", { limit: ROW_LIMIT }),
          listRecordsPage(accessToken, "obligations", { limit: ROW_LIMIT }),
          listAlerts(accessToken),
          getFundClassifications(),
        ])
      : null;

  const [appropriations, allotments, obligations, alerts, fundClassifications] = data ?? [
    { records: [], truncated: false },
    { records: [], truncated: false },
    { records: [], truncated: false },
    [],
    [],
  ];

  const raw: ReportRawData = {
    appropriations: appropriations.records,
    allotments: allotments.records,
    obligations: obligations.records,
    alerts,
    fundClassifications,
    truncated: appropriations.truncated || allotments.truncated || obligations.truncated,
  };

  return (
    <>
      <Header
        title="Report Generation"
        subtitle="Generate and export SAAO and fund utilization reports"
        username={session.email}
      />
      <main className="flex-1 p-7">
        {enabled ? (
          <ReportsContent
            raw={raw}
            fundClassifications={fundClassifications}
            fiscalYears={fiscalYears}
            activeFiscalYearId={activeYear?.id ?? null}
          />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
