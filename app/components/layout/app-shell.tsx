import type { ReactNode } from "react";
import type { AppRole } from "@/app/lib/auth/gotrue";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";

export function AppShell({ role, children }: { role: AppRole; children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#F5F7FA]">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
