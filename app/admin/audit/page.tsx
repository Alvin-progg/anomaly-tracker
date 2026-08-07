import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { getAccessToken } from "@/app/lib/auth/session";
import { getRecentActivity } from "@/app/lib/tracking/tracking";
import { AuditLogTable } from "./audit-log-table";

const AUDIT_LOG_LIMIT = 500;

export default async function AdminAuditPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  const accessToken = await getAccessToken();
  const entries = accessToken ? await getRecentActivity(accessToken, AUDIT_LOG_LIMIT) : [];

  return (
    <>
      <Header title="Audit Log Monitor" subtitle="Full transaction and event history" username={session.email} />
      <main className="flex-1 p-7">
        <AuditLogTable entries={entries} />
      </main>
    </>
  );
}
