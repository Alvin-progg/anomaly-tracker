import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { listAlerts } from "@/app/lib/alerts/alerts";
import { AlertsContent } from "./alerts-content";

export default async function PersonnelAlertsPage() {
  const [session, enabled] = await Promise.all([
    verifySession(),
    isModuleEnabledForPersonnel("ai_alerts"),
  ]);
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const accessToken = await getAccessToken();
  const alerts = enabled && accessToken ? await listAlerts(accessToken) : [];

  return (
    <>
      <Header title="AI Anomaly Alerts" subtitle="AI-assisted review of flagged budget anomalies" username={session.email} />
      <main className="flex-1 p-7">
        {enabled ? (
          <AlertsContent initialData={alerts} />
        ) : (
          <p className="text-sm text-[#6B7A99]">This section is currently unavailable. Contact your System Administrator.</p>
        )}
      </main>
    </>
  );
}
