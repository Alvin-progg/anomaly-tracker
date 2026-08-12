"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import { getAlertById, getObligationContext, updateAlertStatus, type AlertStatus } from "@/app/lib/alerts/alerts";
import { getAlertExplanation } from "@/app/lib/ai/groq";

async function requirePersonnel() {
  const session = await verifySession();
  if (session.role !== "personnel") {
    return { session: null, error: "Not authorized." } as const;
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { session: null, error: "Session expired." } as const;
  }
  return { session, accessToken, error: null } as const;
}

const REVALIDATE_PATH = "/personnel/alerts";
const RESOLVABLE: AlertStatus[] = ["Valid Anomaly", "False Positive", "Needs Further Verification"];

/**
 * Re-reads the alert's current status server-side and only accepts a resolve when it's still
 * Pending — same defensive re-check as updateRecordStatusAction in raao/actions.ts, so a
 * double-submit surfaces a message instead of silently re-writing an already-resolved alert.
 */
export async function updateAlertStatusAction(alertId: string, requestedStatus: AlertStatus): Promise<{ error?: string }> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };
  if (!RESOLVABLE.includes(requestedStatus)) return { error: "Invalid status." };

  const current = await getAlertById(auth.accessToken, alertId);
  if (!current) return { error: "Alert not found." };
  if (current.status !== "Pending") return { error: "This alert has already been reviewed." };

  const result = await updateAlertStatus(auth.accessToken, alertId, requestedStatus);
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: `Marked anomaly alert ${requestedStatus}`,
    details: current.alertRef,
    module: "AI Anomaly Alerts",
  });

  revalidatePath(REVALIDATE_PATH);
  return {};
}

/** Ephemeral — nothing persisted, so no revalidatePath. */
export async function getAiExplanationAction(alertId: string): Promise<{ explanation?: string; error?: string }> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const alert = await getAlertById(auth.accessToken, alertId);
  if (!alert) return { error: "Alert not found." };

  // A lookup miss just means a leaner prompt, not an error — record_ref isn't guaranteed to be
  // an obligation for every alert (seed data can reference any of the four record types).
  const obligation = await getObligationContext(auth.accessToken, alert.recordRef);
  const result = await getAlertExplanation(alert, obligation ?? undefined);
  if (!result.error) {
    await recordAuditEvent({
      accessToken: auth.accessToken,
      userId: auth.session.userId,
      email: auth.session.email,
      role: auth.session.role,
      action: "Requested AI explanation",
      details: alert.alertRef,
      module: "AI Anomaly Alerts",
    });
  }
  return result;
}
