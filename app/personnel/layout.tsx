import { IdleTimeoutProvider } from "@/app/lib/auth/idle-timeout";
import { authEnv } from "@/app/lib/auth/env";

export default function PersonnelLayout({ children }: LayoutProps<"/personnel">) {
  return <IdleTimeoutProvider idleMinutes={authEnv.idleTimeoutMinutes}>{children}</IdleTimeoutProvider>;
}
