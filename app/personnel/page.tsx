import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";

export default async function PersonnelPage() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    redirect("/admin");
  }

  const dashboardEnabled = await isModuleEnabledForPersonnel("dashboard");

  return (
    <>
      <Header title="Dashboard" subtitle="Overview of budget activity" username={session.email} />
      <main className="flex-1 p-7">
        {dashboardEnabled ? (
          <p className="text-sm text-[#6B7A99]">Signed in as {session.email}</p>
        ) : (
          <p className="text-sm text-[#6B7A99]">
            This section is currently unavailable. Contact your System Administrator.
          </p>
        )}
      </main>
    </>
  );
}
