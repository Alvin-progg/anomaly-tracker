import "server-only";
import { authEnv } from "@/app/lib/auth/env";

export interface SystemSettings {
  systemName: string;
  municipalOffice: string;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY";
  notifyEmailAlerts: boolean;
  notifyInApp: boolean;
  notifyDailySummary: boolean;
  notifyAiConfidence: boolean;
}

const DEFAULTS: SystemSettings = {
  systemName: "RAAO Monitor",
  municipalOffice: "Municipal Budget Office – San Pascual",
  dateFormat: "MM/DD/YYYY",
  notifyEmailAlerts: true,
  notifyInApp: true,
  notifyDailySummary: false,
  notifyAiConfidence: true,
};

interface SystemSettingsRow {
  system_name: string;
  municipal_office: string;
  date_format: "MM/DD/YYYY" | "DD/MM/YYYY";
  notify_email_alerts: boolean;
  notify_in_app: boolean;
  notify_daily_summary: boolean;
  notify_ai_confidence: boolean;
}

function fromRow(row: SystemSettingsRow): SystemSettings {
  return {
    systemName: row.system_name,
    municipalOffice: row.municipal_office,
    dateFormat: row.date_format,
    notifyEmailAlerts: row.notify_email_alerts,
    notifyInApp: row.notify_in_app,
    notifyDailySummary: row.notify_daily_summary,
    notifyAiConfidence: row.notify_ai_confidence,
  };
}

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const response = await fetch(`${authEnv.restUrl}/system_settings?select=*&id=eq.1`, {
      headers: { apikey: authEnv.anonKey },
      cache: "no-store",
    });
    if (!response.ok) return DEFAULTS;

    const rows = (await response.json()) as SystemSettingsRow[];
    return rows[0] ? fromRow(rows[0]) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function updateSystemSettings(
  accessToken: string,
  patch: Partial<SystemSettings>
): Promise<{ error?: string }> {
  const body: Partial<SystemSettingsRow> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.systemName !== undefined) body.system_name = patch.systemName;
  if (patch.municipalOffice !== undefined) body.municipal_office = patch.municipalOffice;
  if (patch.dateFormat !== undefined) body.date_format = patch.dateFormat;
  if (patch.notifyEmailAlerts !== undefined) body.notify_email_alerts = patch.notifyEmailAlerts;
  if (patch.notifyInApp !== undefined) body.notify_in_app = patch.notifyInApp;
  if (patch.notifyDailySummary !== undefined) body.notify_daily_summary = patch.notifyDailySummary;
  if (patch.notifyAiConfidence !== undefined) body.notify_ai_confidence = patch.notifyAiConfidence;

  try {
    const response = await fetch(`${authEnv.restUrl}/system_settings?id=eq.1`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: authEnv.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: data?.message ?? "Failed to update system settings." };
    }
    return {};
  } catch {
    return { error: "Failed to update system settings." };
  }
}
