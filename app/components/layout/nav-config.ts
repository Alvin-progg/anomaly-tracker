import type { IconName } from "./icons";
import type { AppRole } from "@/app/lib/auth/gotrue";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export const roleLabel: Record<AppRole, string> = {
  admin: "System Administrator",
  personnel: "Budget Personnel",
};

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "User Accounts", icon: "users" },
  { href: "/admin/roles", label: "Role & Permission", icon: "shield" },
  { href: "/admin/config", label: "System Config", icon: "settings" },
  { href: "/admin/security", label: "Security", icon: "lock" },
  { href: "/admin/audit", label: "Audit Log", icon: "log" },
  { href: "/admin/backup", label: "Backup & Recovery", icon: "backup" },
];

const personnelNav: NavItem[] = [
  { href: "/personnel", label: "Dashboard", icon: "dashboard" },
  { href: "/personnel/raao", label: "RAAO Records", icon: "file" },
  { href: "/personnel/monitoring", label: "Budget Monitoring", icon: "monitoring" },
  { href: "/personnel/alerts", label: "AI Anomaly Alerts", icon: "alert" },
  { href: "/personnel/documents", label: "Document Creation", icon: "compose" },
  { href: "/personnel/reports", label: "Report Generation", icon: "report" },
  { href: "/personnel/archives", label: "Archives / Search", icon: "archive" },
];

export function navForRole(role: AppRole): NavItem[] {
  return role === "admin" ? adminNav : personnelNav;
}
