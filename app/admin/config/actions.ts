"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import { updateSystemSettings, type SystemSettings } from "@/app/lib/config/settings";
import { createFiscalYear, activateFiscalYear, getFiscalYears } from "@/app/lib/config/fiscal-years";
import { createFinancialThreshold, updateFinancialThreshold } from "@/app/lib/config/thresholds";
import { isThresholdModule, isThresholdType } from "@/app/lib/config/threshold-types";
import {
  createFundClassification,
  updateFundClassification,
  setFundClassificationActive,
} from "@/app/lib/config/funds";

export interface ConfigFormState {
  error?: string;
}

async function requireAdmin() {
  const session = await verifySession();
  if (session.role !== "admin") {
    return { session: null, error: "Not authorized." } as const;
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { session: null, error: "Session expired." } as const;
  }
  return { session, accessToken, error: null } as const;
}

export async function updateGeneralSettingsAction(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const systemName = String(formData.get("systemName") ?? "").trim();
  const municipalOffice = String(formData.get("municipalOffice") ?? "").trim();
  const dateFormat = String(formData.get("dateFormat") ?? "");

  if (!systemName || !municipalOffice || (dateFormat !== "MM/DD/YYYY" && dateFormat !== "DD/MM/YYYY")) {
    return { error: "Please fill in all fields." };
  }

  const result = await updateSystemSettings(admin.accessToken, {
    systemName,
    municipalOffice,
    dateFormat,
  });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated general settings",
    details: systemName,
  });

  revalidatePath("/admin/config");
  return {};
}

const NOTIFICATION_FIELDS = [
  "notifyEmailAlerts",
  "notifyInApp",
  "notifyDailySummary",
  "notifyAiConfidence",
] as const;
type NotificationField = (typeof NOTIFICATION_FIELDS)[number];

function isNotificationField(value: string): value is NotificationField {
  return (NOTIFICATION_FIELDS as readonly string[]).includes(value);
}

export async function updateNotificationSettingAction(
  field: string,
  enabled: boolean
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  if (!isNotificationField(field)) {
    return { error: "Invalid setting." };
  }

  const patch: Partial<SystemSettings> = { [field]: enabled };
  const result = await updateSystemSettings(admin.accessToken, patch);
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated notification setting",
    details: `${field}: ${enabled ? "on" : "off"}`,
  });

  revalidatePath("/admin/config");
  return {};
}

export async function createFiscalYearAction(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const label = String(formData.get("label") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!label || !startDate || !endDate) {
    return { error: "Please fill in all fields." };
  }
  if (startDate >= endDate) {
    return { error: "Start date must be before end date." };
  }

  const result = await createFiscalYear(admin.accessToken, { label, startDate, endDate });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Created fiscal year",
    details: label,
  });

  revalidatePath("/admin/config");
  return {};
}

/**
 * The audit label is resolved from the id server-side rather than taken from the caller: the client
 * used to pass it, which meant a crafted call could log any label it liked against a real id.
 */
export async function activateFiscalYearAction(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const result = await activateFiscalYear(admin.accessToken, id);
  if (result.error) return { error: result.error };

  const label = (await getFiscalYears()).find((year) => year.id === id)?.label ?? id;

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Activated fiscal year",
    details: label,
  });

  revalidatePath("/admin/config");
  return {};
}

export async function createFinancialThresholdAction(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const name = String(formData.get("name") ?? "").trim();
  const thresholdModule = String(formData.get("module") ?? "");
  const type = String(formData.get("type") ?? "");
  const value = String(formData.get("value") ?? "").trim();

  if (!name || !value || !isThresholdModule(thresholdModule) || !isThresholdType(type)) {
    return { error: "Please fill in all fields." };
  }

  const result = await createFinancialThreshold(admin.accessToken, { name, module: thresholdModule, type, value });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Created financial threshold",
    details: name,
  });

  revalidatePath("/admin/config");
  return {};
}

export async function updateFinancialThresholdAction(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const thresholdModule = String(formData.get("module") ?? "");
  const type = String(formData.get("type") ?? "");
  const value = String(formData.get("value") ?? "").trim();

  if (!id || !name || !value || !isThresholdModule(thresholdModule) || !isThresholdType(type)) {
    return { error: "Please fill in all fields." };
  }

  const result = await updateFinancialThreshold(admin.accessToken, id, { name, module: thresholdModule, type, value });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated financial threshold",
    details: name,
  });

  revalidatePath("/admin/config");
  return {};
}

export async function createFundClassificationAction(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const name = String(formData.get("name") ?? "").trim();
  const shortCode = String(formData.get("shortCode") ?? "").trim();

  if (!name || !shortCode) {
    return { error: "Please fill in all fields." };
  }

  const result = await createFundClassification(admin.accessToken, { name, shortCode });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Created fund classification",
    details: name,
  });

  revalidatePath("/admin/config");
  return {};
}

export async function updateFundClassificationAction(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin();
  if (!admin.session) return { error: admin.error };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const shortCode = String(formData.get("shortCode") ?? "").trim();

  if (!id || !name || !shortCode) {
    return { error: "Please fill in all fields." };
  }

  const result = await updateFundClassification(admin.accessToken, id, { name, shortCode });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: "Updated fund classification",
    details: name,
  });

  revalidatePath("/admin/config");
  return {};
}

export async function toggleFundClassificationActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.session) return;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const nextActive = formData.get("nextActive") === "true";
  if (!id) return;

  const result = await setFundClassificationActive(admin.accessToken, id, nextActive);
  if (result.error) {
    console.error("toggleFundClassificationActiveAction failed:", result.error);
    return;
  }

  await recordAuditEvent({
    accessToken: admin.accessToken,
    userId: admin.session.userId,
    email: admin.session.email,
    role: admin.session.role,
    action: nextActive ? "Activated fund classification" : "Deactivated fund classification",
    details: name,
  });

  revalidatePath("/admin/config");
}
