export const PERSONNEL_MODULES = {
  login: "Login / Authentication",
  dashboard: "Dashboard",
  raao_records: "RAAO Records",
  budget_monitoring: "Budget Monitoring",
  ai_alerts: "AI Anomaly Alerts",
  document_creation: "Document Creation",
  reports: "Report Generation",
  archives: "Archives / Search",
} as const;

export const ADMIN_ONLY_MODULES = {
  user_accounts: "User Account Management",
  role_permission: "Role & Permission",
  system_config: "System Configuration",
  security: "Security",
  audit_log: "Audit Log Monitoring",
  backup: "Backup & Recovery",
} as const;

export type PersonnelModule = keyof typeof PERSONNEL_MODULES;

export function isPersonnelModule(module: string): module is PersonnelModule {
  return module in PERSONNEL_MODULES;
}
