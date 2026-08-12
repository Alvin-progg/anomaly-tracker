import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { BudgetMonitoringContent } from "./monitoring-content";

export default async function BudgetMonitoringPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const monitoringEnabled = await isModuleEnabledForPersonnel("budget_monitoring");

  return (
    <>
      <Header
        title="Budget Monitoring"
        subtitle="Fund utilization and department budget monitoring"
        username={session.email}
      />
      <main className="flex-1 p-7">
        {monitoringEnabled ? (
          <BudgetMonitoringContent />
        ) : (
          <p className="text-sm text-[#6B7A99]">
            This section is currently unavailable. Contact your System Administrator.
          </p>
        )}
      </main>
    </>
  );
}
