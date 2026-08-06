import { IdleTimeoutProvider } from "@/app/lib/auth/idle-timeout";
import { getSecuritySettings } from "@/app/lib/config/security";
import { AppShell } from "@/app/components/layout/app-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { sessionTimeoutMinutes } = await getSecuritySettings();
  return (
    <IdleTimeoutProvider idleMinutes={sessionTimeoutMinutes}>
      <AppShell role="admin">{children}</AppShell>
    </IdleTimeoutProvider>
  );
}
