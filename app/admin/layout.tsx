import { IdleTimeoutProvider } from "@/app/lib/auth/idle-timeout";
import { authEnv } from "@/app/lib/auth/env";
import { AppShell } from "@/app/components/layout/app-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <IdleTimeoutProvider idleMinutes={authEnv.idleTimeoutMinutes}>
      <AppShell role="admin">{children}</AppShell>
    </IdleTimeoutProvider>
  );
}
