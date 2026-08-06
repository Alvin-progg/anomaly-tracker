import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { Header } from "@/app/components/layout/header";
import { getSecuritySettings } from "@/app/lib/config/security";
import { PasswordPolicyForm } from "./password-policy-form";
import { SessionAuthForm } from "./session-auth-form";

export default async function SecurityPoliciesPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  const settings = await getSecuritySettings();

  return (
    <>
      <Header title="Security Policies" subtitle="Password policy, session timeout, and authentication settings" username={session.email} />
      <main className="flex-1 p-7 grid grid-cols-2 gap-5">
        <PasswordPolicyForm settings={settings} />
        <SessionAuthForm settings={settings} />
      </main>
    </>
  );
}
