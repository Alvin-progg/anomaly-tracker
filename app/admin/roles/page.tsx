import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { getPersonnelPermissions } from "@/app/lib/permissions/permissions";
import { RolePermissionMatrix } from "./role-permission-matrix";

export default async function AdminRolesPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  const permissions = await getPersonnelPermissions();

  return (
    <>
      <Header title="Role & Permission" subtitle="Manage module access per role" username={session.email} />
      <main className="flex-1 p-7">
        <RolePermissionMatrix permissions={permissions} />
      </main>
    </>
  );
}
