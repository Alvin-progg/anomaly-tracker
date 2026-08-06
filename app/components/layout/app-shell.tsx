import type { ReactNode } from "react";
import type { AppRole } from "@/app/lib/auth/gotrue";
import { getPersonnelPermissions } from "@/app/lib/permissions/permissions";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";

export async function AppShell({ role, children }: { role: AppRole; children: ReactNode }) {
  const enabledModules = role === "personnel" ? await getPersonnelPermissions() : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} enabledModules={enabledModules} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#F5F7FA]">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
