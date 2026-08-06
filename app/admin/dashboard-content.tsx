import Link from "next/link";
import { Icon, type IconName } from "@/app/components/layout/icons";
import { KpiCard } from "@/app/components/ui/kpi-card";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { Badge } from "@/app/components/ui/badge";
import { Btn } from "@/app/components/ui/btn";
import { roleLabel } from "@/app/components/layout/nav-config";
import type { AppRole } from "@/app/lib/auth/gotrue";
import { getAccessToken } from "@/app/lib/auth/session";
import { getActiveSessions, getRecentActivity } from "@/app/lib/tracking/tracking";
import { getSystemMetrics } from "@/app/lib/system/metrics";

const quickActions: { label: string; href: string; icon: IconName }[] = [
  { label: "Run System Backup", href: "/admin/backup", icon: "backup" },
  { label: "Add New User Account", href: "/admin/users", icon: "users" },
  { label: "View Full Audit Log", href: "/admin/audit", icon: "log" },
  { label: "Configure Thresholds", href: "/admin/config", icon: "settings" },
];

function formatSince(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function roleName(role: string): string {
  return roleLabel[role as AppRole] ?? role;
}

export async function DashboardContent() {
  const accessToken = await getAccessToken();

  const [metrics, activeSessions, recentActivity] = await Promise.all([
    getSystemMetrics(),
    accessToken ? getActiveSessions(accessToken) : Promise.resolve([]),
    accessToken ? getRecentActivity(accessToken) : Promise.resolve([]),
  ]);

  const adminCount = activeSessions.filter((s) => s.role === "admin").length;
  const personnelCount = activeSessions.filter((s) => s.role === "personnel").length;

  const kpis: { label: string; value: string; sub: string; icon: IconName }[] = [
    { label: "CPU Usage", value: metrics.cpuPct, sub: metrics.cpuSub, icon: "cpu" },
    { label: "Memory Usage", value: metrics.memPct, sub: metrics.memSub, icon: "memory" },
    { label: "Uptime", value: metrics.uptimeLabel, sub: metrics.uptimeSub, icon: "uptime" },
    {
      label: "Active Sessions",
      value: String(activeSessions.length),
      sub: `${adminCount} admin${adminCount === 1 ? "" : "s"}, ${personnelCount} personnel`,
      icon: "users",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3.5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} icon={<Icon name={kpi.icon} />} />
        ))}
      </div>

      <SectionCard>
        <div className="flex justify-between items-center mb-3.5">
          <SectionTitle>Recent Activity</SectionTitle>
          <Btn variant="ghost" small href="/admin/audit">
            View Full Log
          </Btn>
        </div>
        <TableContainer>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#D1D9E6]">
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Timestamp</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">User</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Module</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Action</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-[#6B7A99] uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-xs text-[#6B7A99] text-center">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                recentActivity.map((row) => (
                  <tr key={row.id} className="border-b border-[#EEF2F7] last:border-0">
                    <td className="px-4 py-2.5 text-xs font-mono text-[#6B7A99]">{formatTimestamp(row.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#1A2033] font-medium">{row.email}</td>
                    <td className="px-4 py-2.5">
                      <Badge label={row.module} variant="blue" />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#1A2033]">{row.action}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7A99]">{row.details ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableContainer>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard>
          <SectionTitle>Quick Actions</SectionTitle>
          <div className="flex flex-col gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F8FAFC] border border-[#E8ECF1] rounded-md text-[13px] text-[#1F3864] font-medium hover:bg-[#EFF6FF] transition-colors"
              >
                <Icon name={action.icon} />
                {action.label}
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Session Overview</SectionTitle>
          <div className="flex flex-col gap-3">
            {activeSessions.length === 0 ? (
              <div className="text-xs text-[#6B7A99]">No active sessions.</div>
            ) : (
              activeSessions.map((session) => (
                <div key={session.id} className="flex justify-between items-center">
                  <div>
                    <div className="text-[13px] font-semibold text-[#1A2033]">{session.email}</div>
                    <div className="text-[11px] text-[#6B7A99]">
                      {roleName(session.role)} · Since {formatSince(session.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#6B7A99]">{session.ip_address ?? "unknown"}</span>
                    <Badge label="Active" variant="green" />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
