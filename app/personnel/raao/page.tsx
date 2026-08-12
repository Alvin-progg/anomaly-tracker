import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getFundClassifications } from "@/app/lib/config/funds";
import { listRecords, getDepartments, listObligationsForPicker } from "@/app/lib/raao/records";
import { RaaoRecordsContent } from "./raao-records-content";

export default async function PersonnelRaaoPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const enabled = await isModuleEnabledForPersonnel("raao_records");
  const accessToken = await getAccessToken();

  const data =
    enabled && accessToken
      ? await Promise.all([
          listRecords(accessToken, "appropriations", { limit: 500 }),
          listRecords(accessToken, "allotments", { limit: 500 }),
          listRecords(accessToken, "obligations", { limit: 500 }),
          listRecords(accessToken, "liquidations", { limit: 500 }),
          getDepartments(accessToken),
          listObligationsForPicker(accessToken),
          getFundClassifications(),
        ])
      : null;

  const [appropriations, allotments, obligations, liquidations, departments, obligationOptions, fundClassifications] =
    data ?? [[], [], [], [], [], [], []];

  return (
    <>
      <Header title="RAAO Record Management" subtitle="Appropriations, allotments, obligations & liquidations" username={session.email} />
      <main className="flex-1 p-7">
        {enabled ? (
          <RaaoRecordsContent
            initialData={{ appropriations, allotments, obligations, liquidations }}
            departments={departments}
            obligationOptions={obligationOptions}
            fundClassifications={fundClassifications}
          />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
