import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getFundClassifications } from "@/app/lib/config/funds";
import { listRecords, type RaaoTab, type RaaoRecord } from "@/app/lib/raao/records";
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

  const data =
    enabled && accessToken
      ? await Promise.all([
          listRecords(accessToken, "appropriations", { limit: 500 }),
          listRecords(accessToken, "allotments", { limit: 500 }),
          listRecords(accessToken, "obligations", { limit: 500 }),
          listRecords(accessToken, "liquidations", { limit: 500 }),
          getFundClassifications(),
        ])
      : null;

  const [appropriations, allotments, obligations, liquidations, fundClassifications] =
    data ?? [[], [], [], [], []];

  const records = [
    ...tag("appropriations", appropriations),
    ...tag("allotments", allotments),
    ...tag("obligations", obligations),
    ...tag("liquidations", liquidations),
  ].sort((a, b) => b.recordDate.localeCompare(a.recordDate));

  return (
    <>
      <Header
        title="Archives & Record Search"
        subtitle="Search and retrieve historical RAAO financial records"
        username={session.email}
      />
      <main className="flex-1 p-7">
        {enabled ? (
          <ArchivesContent records={records} fundClassifications={fundClassifications} />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
