import { IdleTimeoutProvider } from "@/app/lib/auth/idle-timeout";
import { authEnv } from "@/app/lib/auth/env";
import { AppShell } from "@/app/components/layout/app-shell";

export default function PersonnelLayout({ children }: LayoutProps<"/personnel">) {
  return (
    <IdleTimeoutProvider idleMinutes={authEnv.idleTimeoutMinutes}>
      <AppShell role="personnel">{children}</AppShell>
    </IdleTimeoutProvider>
  );
}
