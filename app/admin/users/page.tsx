import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { listUsers } from "@/app/lib/auth/admin";
import { getSecuritySettings } from "@/app/lib/config/security";
import { UserAccountsTable, type DisplayUser } from "./user-accounts-table";
import type { AppRole } from "@/app/lib/auth/gotrue";

function toDisplayUser(user: Awaited<ReturnType<typeof listUsers>>[number]): DisplayUser {
  const email = user.email;
  return {
    id: user.id,
    fullName: user.user_metadata?.full_name || email.split("@")[0],
    username: email.split("@")[0],
    email,
    role: (user.app_metadata?.role as AppRole) ?? "personnel",
    banned: Boolean(user.banned_until),
    lastLogin: user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : "Never",
  };
}

export default async function AdminUsersPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  const users = (await listUsers()).map(toDisplayUser);
  // The Reset 2FA action is pointless noise while Two-Factor Authentication is switched off.
  const { twoFactorEnabled } = await getSecuritySettings();

  return (
    <>
      <Header title="User Accounts" subtitle="Manage personnel and administrator accounts" username={session.email} />
      <main className="flex-1 p-7">
        <UserAccountsTable users={users} twoFactorEnabled={twoFactorEnabled} />
      </main>
    </>
  );
}
