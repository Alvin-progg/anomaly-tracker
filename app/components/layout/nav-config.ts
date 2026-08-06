import type { IconName } from "./icons";
import type { AppRole } from "@/app/lib/auth/gotrue";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  module: string;
}

export const roleLabel: Record<AppRole, string> = {
  admin: "System Administrator",
  personnel: "Budget Personnel",
};

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", module: "dashboard" },
  { href: "/admin/users", label: "User Accounts", icon: "users", module: "user_accounts" },
  { href: "/admin/roles", label: "Role & Permission", icon: "shield", module: "role_permission" },
  { href: "/admin/config", label: "System Config", icon: "settings", module: "system_config" },
  { href: "/admin/security", label: "Security", icon: "lock", module: "security" },
  { href: "/admin/audit", label: "Audit Log", icon: "log", module: "audit_log" },
  { href: "/admin/backup", label: "Backup & Recovery", icon: "backup", module: "backup" },
];

const personnelNav: NavItem[] = [
  { href: "/personnel", label: "Dashboard", icon: "dashboard", module: "dashboard" },
  { href: "/personnel/raao", label: "RAAO Records", icon: "file", module: "raao_records" },
  { href: "/personnel/monitoring", label: "Budget Monitoring", icon: "monitoring", module: "budget_monitoring" },
  { href: "/personnel/alerts", label: "AI Anomaly Alerts", icon: "alert", module: "ai_alerts" },
  { href: "/personnel/documents", label: "Document Creation", icon: "compose", module: "document_creation" },
  { href: "/personnel/reports", label: "Report Generation", icon: "report", module: "reports" },
  { href: "/personnel/archives", label: "Archives / Search", icon: "archive", module: "archives" },
];

export function navForRole(role: AppRole): NavItem[] {
  return role === "admin" ? adminNav : personnelNav;
}
