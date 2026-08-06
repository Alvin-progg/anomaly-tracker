import { IdleTimeoutProvider } from "@/app/lib/auth/idle-timeout";
import { getSecuritySettings } from "@/app/lib/config/security";
import { AppShell } from "@/app/components/layout/app-shell";

export default async function PersonnelLayout({ children }: LayoutProps<"/personnel">) {
  const { sessionTimeoutMinutes } = await getSecuritySettings();
  return (
    <IdleTimeoutProvider idleMinutes={sessionTimeoutMinutes}>
      <AppShell role="personnel">{children}</AppShell>
    </IdleTimeoutProvider>
  );
}
