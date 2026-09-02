import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getFundClassifications } from "@/app/lib/config/funds";
import { listRecordsPage, type RaaoTab, type RaaoRecord } from "@/app/lib/raao/records";
import { ArchivesContent, type ArchiveRecord } from "./archives-content";

const RECORD_TYPE: Record<RaaoTab, ArchiveRecord["recordType"]> = {
  appropriations: "Appropriation",
  allotments: "Allotment",
  obligations: "Obligation",
  liquidations: "Liquidation",
};

function tag(tab: RaaoTab, rows: RaaoRecord[]): ArchiveRecord[] {
  return rows.map((row) => ({ ...row, tab, recordType: RECORD_TYPE[tab] }));
}

export default async function PersonnelArchivesPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const enabled = await isModuleEnabledForPersonnel("archives");
  const accessToken = await getAccessToken();

  /**
   * Deliberately not scoped to a fiscal year — this module exists to search closed years. The row
   * cap is surfaced instead, so a search that silently missed older rows says so.
   */
  const empty = { records: [] as RaaoRecord[], truncated: false };
  const data =
    enabled && accessToken
      ? await Promise.all([
          listRecordsPage(accessToken, "appropriations", { limit: 500 }),
          listRecordsPage(accessToken, "allotments", { limit: 500 }),
          listRecordsPage(accessToken, "obligations", { limit: 500 }),
          listRecordsPage(accessToken, "liquidations", { limit: 500 }),
          getFundClassifications(),
        ])
      : null;

  const [appropriations, allotments, obligations, liquidations, fundClassifications] =
    data ?? [empty, empty, empty, empty, []];

  const records = [
    ...tag("appropriations", appropriations.records),
    ...tag("allotments", allotments.records),
    ...tag("obligations", obligations.records),
    ...tag("liquidations", liquidations.records),
  ].sort((a, b) => b.recordDate.localeCompare(a.recordDate));

  const truncated =
    appropriations.truncated || allotments.truncated || obligations.truncated || liquidations.truncated;

  return (
    <>
      <Header
        title="Archives & Record Search"
        subtitle="Search and retrieve historical RAAO financial records"
        username={session.email}
      />
      <main className="flex-1 p-7">
        {enabled ? (
          <ArchivesContent records={records} fundClassifications={fundClassifications} truncated={truncated} />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
