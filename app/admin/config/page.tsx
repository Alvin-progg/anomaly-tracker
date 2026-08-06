import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { getSystemSettings } from "@/app/lib/config/settings";
import { getFiscalYears } from "@/app/lib/config/fiscal-years";
import { getFinancialThresholds } from "@/app/lib/config/thresholds";
import { getFundClassifications } from "@/app/lib/config/funds";
import { SystemSettingsForm } from "./system-settings-form";
import { FiscalYearSettings } from "./fiscal-year-settings";
import { FinancialThresholdsTable } from "./financial-thresholds-table";
import { FundClassificationsTable } from "./fund-classifications-table";

export default async function SystemConfigPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  const [settings, fiscalYears, thresholds, funds] = await Promise.all([
    getSystemSettings(),
    getFiscalYears(),
    getFinancialThresholds(),
    getFundClassifications(),
  ]);

  return (
    <>
      <Header title="System Configuration" subtitle="General settings, fiscal years, thresholds, and fund classification" username={session.email} />
      <main className="flex-1 p-7 flex flex-col gap-5">
        <SystemSettingsForm settings={settings} />
        <FiscalYearSettings fiscalYears={fiscalYears} />
        <FinancialThresholdsTable thresholds={thresholds} />
        <FundClassificationsTable funds={funds} />
      </main>
    </>
  );
}
