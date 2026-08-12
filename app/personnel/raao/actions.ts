"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/tracking/tracking";
import {
  createAppropriation,
  createAllotment,
  createObligation,
  createLiquidation,
  updateAppropriation,
  updateAllotment,
  updateObligation,
  updateLiquidation,
  setObligationAttachment,
  getRecordById,
  getActiveFiscalYearId,
  type RaaoTab,
  type RecordStatus,
} from "@/app/lib/raao/records";
import { obligationAttachmentPath, uploadObligationAttachment } from "@/app/lib/raao/attachments";
import { detectAnomalies } from "@/app/lib/alerts/alerts";

export interface RaaoFormState {
  error?: string;
  warning?: string;
}

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

function parseAmount(raw: FormDataEntryValue | null): number | null {
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

const REVALIDATE_PATH = "/personnel/raao";

export async function createAppropriationAction(_prevState: RaaoFormState, formData: FormData): Promise<RaaoFormState> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const ref = String(formData.get("ref") ?? "").trim();
  const fundId = String(formData.get("fundId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const recordDate = String(formData.get("recordDate") ?? "");

  if (!ref || !fundId || !departmentId || !description || amount === null || !recordDate) {
    return { error: "Please fill in all fields." };
  }

  const fiscalYearId = await getActiveFiscalYearId();
  if (!fiscalYearId) return { error: "No active fiscal year configured." };

  const result = await createAppropriation(auth.accessToken, {
    ref,
    fiscalYearId,
    fundId,
    departmentId,
    description,
    amount,
    recordDate,
    status: "pending",
  });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: "Created appropriation",
    details: ref,
    module: "RAAO Records",
  });

  revalidatePath(REVALIDATE_PATH);
  return {};
}

export async function createAllotmentAction(_prevState: RaaoFormState, formData: FormData): Promise<RaaoFormState> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const ref = String(formData.get("ref") ?? "").trim();
  const fundId = String(formData.get("fundId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const recordDate = String(formData.get("recordDate") ?? "");

  if (!ref || !fundId || !departmentId || !description || amount === null || !recordDate) {
    return { error: "Please fill in all fields." };
  }

  const fiscalYearId = await getActiveFiscalYearId();
  if (!fiscalYearId) return { error: "No active fiscal year configured." };

  const result = await createAllotment(auth.accessToken, {
    ref,
    fiscalYearId,
    fundId,
    departmentId,
    description,
    amount,
    recordDate,
    status: "pending",
  });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: "Created allotment",
    details: ref,
    module: "RAAO Records",
  });

  revalidatePath(REVALIDATE_PATH);
  return {};
}

/**
 * Creates the obligation first and attaches the supporting document after, so a failed upload
 * never costs the record itself — a certified obligation missing its attachment is recoverable
 * (re-edit and re-upload); a lost obligation is not.
 */
export async function createObligationAction(_prevState: RaaoFormState, formData: FormData): Promise<RaaoFormState> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const ref = String(formData.get("ref") ?? "").trim();
  const fundId = String(formData.get("fundId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const recordDate = String(formData.get("recordDate") ?? "");
  const payee = String(formData.get("payee") ?? "").trim();
  const attachment = formData.get("attachment");

  if (!ref || !fundId || !departmentId || !description || amount === null || !recordDate || !payee) {
    return { error: "Please fill in all fields." };
  }

  const fiscalYearId = await getActiveFiscalYearId();
  if (!fiscalYearId) return { error: "No active fiscal year configured." };

  const result = await createObligation(auth.accessToken, {
    ref,
    fiscalYearId,
    fundId,
    departmentId,
    description,
    amount,
    recordDate,
    status: "certified",
    payee,
  });
  if (result.error) return { error: result.error };
  const obligationId = result.id!;

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: "Created obligation (Submit & Certify)",
    details: ref,
    module: "RAAO Records",
  });

  let warning: string | undefined;
  if (attachment instanceof File && attachment.size > 0) {
    const objectPath = obligationAttachmentPath(obligationId, attachment.name);
    const upload = await uploadObligationAttachment(auth.accessToken, objectPath, attachment);
    if (upload.error) {
      warning = "Obligation created, but the supporting document failed to upload. Edit the record to try again.";
    } else {
      await setObligationAttachment(auth.accessToken, obligationId, objectPath);
    }
  }

  // Best-effort — a detection failure must never block the obligation that was already created.
  let spikeWarning: string | undefined;
  try {
    const alerts = await detectAnomalies(auth.accessToken, obligationId);
    if (alerts.length > 0) {
      spikeWarning = `Flagged ${alerts.length} potential anomaly alert${alerts.length > 1 ? "s" : ""} for review: ${alerts.map((a) => a.alertRef).join(", ")}.`;
    }
  } catch {
    // ignore — detection is not part of the obligation's own success/failure path
  }

  revalidatePath(REVALIDATE_PATH);
  const combinedWarning = warning ?? spikeWarning;
  return combinedWarning ? { warning: combinedWarning } : {};
}

export async function createLiquidationAction(_prevState: RaaoFormState, formData: FormData): Promise<RaaoFormState> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const ref = String(formData.get("ref") ?? "").trim();
  const obligationId = String(formData.get("obligationId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const recordDate = String(formData.get("recordDate") ?? "");

  if (!ref || !obligationId || !description || amount === null || !recordDate) {
    return { error: "Please fill in all fields." };
  }

  const result = await createLiquidation(auth.accessToken, {
    ref,
    obligationId,
    description,
    amount,
    recordDate,
    status: "pending",
  });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: "Created liquidation",
    details: ref,
    module: "RAAO Records",
  });

  revalidatePath(REVALIDATE_PATH);
  return {};
}

export async function updateRecordFieldsAction(_prevState: RaaoFormState, formData: FormData): Promise<RaaoFormState> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const tab = String(formData.get("tab") ?? "") as RaaoTab;
  const id = String(formData.get("id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const recordDate = String(formData.get("recordDate") ?? "");
  const payee = formData.get("payee");

  if (!id || !description || amount === null || !recordDate) {
    return { error: "Please fill in all fields." };
  }

  const patch = { description, amount, recordDate };
  const result =
    tab === "appropriations"
      ? await updateAppropriation(auth.accessToken, id, patch)
      : tab === "allotments"
        ? await updateAllotment(auth.accessToken, id, patch)
        : tab === "obligations"
          ? await updateObligation(auth.accessToken, id, { ...patch, payee: payee ? String(payee).trim() : undefined })
          : tab === "liquidations"
            ? await updateLiquidation(auth.accessToken, id, patch)
            : { error: "Unknown record type." };
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: "Updated record",
    details: id,
    module: "RAAO Records",
  });

  revalidatePath(REVALIDATE_PATH);
  return {};
}

/** pending → certified → posted; obligations skip pending (they're created already certified). */
function nextAllowedStatus(current: RecordStatus, tab: RaaoTab): RecordStatus | null {
  if (tab === "obligations") return current === "certified" ? "posted" : null;
  if (current === "pending") return "certified";
  if (current === "certified") return "posted";
  return null;
}

/**
 * Re-reads the record's current status server-side and only accepts the single legal next step —
 * a crafted request naming an out-of-order transition is rejected here even though RLS alone
 * would allow the raw write.
 */
export async function updateRecordStatusAction(_prevState: RaaoFormState, formData: FormData): Promise<RaaoFormState> {
  const auth = await requirePersonnel();
  if (!auth.session) return { error: auth.error };

  const tab = String(formData.get("tab") ?? "") as RaaoTab;
  const id = String(formData.get("id") ?? "");
  const requestedStatus = String(formData.get("requestedStatus") ?? "") as RecordStatus;
  if (!id || !requestedStatus) return { error: "Missing record or target status." };

  const record = await getRecordById(auth.accessToken, tab, id);
  if (!record) return { error: "Record not found." };

  const allowed = nextAllowedStatus(record.status, tab);
  if (!allowed || allowed !== requestedStatus) {
    return { error: "Invalid status transition." };
  }

  const result =
    tab === "appropriations"
      ? await updateAppropriation(auth.accessToken, id, { status: allowed })
      : tab === "allotments"
        ? await updateAllotment(auth.accessToken, id, { status: allowed })
        : tab === "obligations"
          ? await updateObligation(auth.accessToken, id, { status: allowed })
          : await updateLiquidation(auth.accessToken, id, { status: allowed });
  if (result.error) return { error: result.error };

  await recordAuditEvent({
    accessToken: auth.accessToken,
    userId: auth.session.userId,
    email: auth.session.email,
    role: auth.session.role,
    action: `Marked record ${allowed}`,
    details: record.ref,
    module: "RAAO Records",
  });

  revalidatePath(REVALIDATE_PATH);
  return {};
}
