import "server-only";
import { authEnv } from "@/app/lib/auth/env";
import { getFiscalYears } from "@/app/lib/config/fiscal-years";

/**
 * Read/write layer for the RAAO Record Management module (/personnel/raao) — the create/edit
 * counterpart to app/lib/budget/dashboard.ts's read-only aggregates. Bearer-token style
 * throughout: every one of these tables is RLS-gated to signed-in admin/personnel, never anon.
 */

export type RaaoTab = "appropriations" | "allotments" | "obligations" | "liquidations";
export type RecordStatus = "draft" | "pending" | "certified" | "posted";

export interface RaaoRecord {
  id: string;
  ref: string;
  fundName: string | null;
  fundShortCode: string | null;
  departmentName: string | null;
  description: string;
  amount: number;
  status: RecordStatus;
  recordDate: string;
  /** Obligations only. */
  payee: string | null;
  /** Obligations only — a Storage object path, resolved through /personnel/raao/download/[id]. */
  attachmentPath: string | null;
  /** Liquidations only — the parent obligation's reference. */
  obligationRef: string | null;
}

export interface Department {
  id: string;
  name: string;
  shortCode: string;
}

export interface ObligationOption {
  id: string;
  ref: string;
  fundName: string;
  fundShortCode: string;
  departmentName: string;
}

function authHeaders(accessToken: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: authEnv.anonKey, Authorization: `Bearer ${accessToken}`, ...extra };
}

const num = (value: unknown): number => Number(value ?? 0);

const TABLE: Record<RaaoTab, string> = {
  appropriations: "appropriations",
  allotments: "allotments",
  obligations: "obligations",
  liquidations: "liquidations",
};

interface JoinedFund {
  name: string;
  short_code: string;
}
interface JoinedDepartment {
  name: string;
}
interface RecordRow {
  id: string;
  ref: string;
  description: string;
  amount: number | string;
  status: RecordStatus;
  record_date: string;
  payee?: string | null;
  attachment_path?: string | null;
  fund_classifications?: JoinedFund | null;
  departments?: JoinedDepartment | null;
  obligations?: {
    ref: string;
    fund_classifications: JoinedFund | null;
    departments: JoinedDepartment | null;
  } | null;
}

function fromRow(row: RecordRow): RaaoRecord {
  const fund = row.fund_classifications ?? row.obligations?.fund_classifications ?? null;
  const department = row.departments ?? row.obligations?.departments ?? null;
  return {
    id: row.id,
    ref: row.ref,
    fundName: fund?.name ?? null,
    fundShortCode: fund?.short_code ?? null,
    departmentName: department?.name ?? null,
    description: row.description,
    amount: num(row.amount),
    status: row.status,
    recordDate: row.record_date,
    payee: row.payee ?? null,
    attachmentPath: row.attachment_path ?? null,
    obligationRef: row.obligations?.ref ?? null,
  };
}

function selectFor(tab: RaaoTab): string {
  return tab === "liquidations"
    ? "select=*,obligations(ref,fund_classifications(name,short_code),departments(name))"
    : "select=*,fund_classifications(name,short_code),departments(name)";
}

export async function listRecords(
  accessToken: string,
  tab: RaaoTab,
  options: { search?: string; limit?: number } = {}
): Promise<RaaoRecord[]> {
  const params = [selectFor(tab), "order=record_date.desc"];
  if (options.limit) params.push(`limit=${options.limit}`);
  const search = options.search?.trim();
  if (search) {
    const term = search.replace(/[,()]/g, "");
    params.push(`or=(ref.ilike.*${term}*,description.ilike.*${term}*)`);
  }

  try {
    const response = await fetch(`${authEnv.restUrl}/${TABLE[tab]}?${params.join("&")}`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as RecordRow[];
    return rows.map(fromRow);
  } catch {
    return [];
  }
}

export async function getRecordById(accessToken: string, tab: RaaoTab, id: string): Promise<RaaoRecord | null> {
  try {
    const response = await fetch(
      `${authEnv.restUrl}/${TABLE[tab]}?${selectFor(tab)}&id=eq.${id}&limit=1`,
      { headers: authHeaders(accessToken), cache: "no-store" }
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as RecordRow[];
    return rows[0] ? fromRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getDepartments(accessToken: string): Promise<Department[]> {
  try {
    const response = await fetch(`${authEnv.restUrl}/departments?select=id,name,short_code&active=eq.true&order=name.asc`, {
      headers: authHeaders(accessToken),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as { id: string; name: string; short_code: string }[];
    return rows.map((row) => ({ id: row.id, name: row.name, shortCode: row.short_code }));
  } catch {
    return [];
  }
}

export async function listObligationsForPicker(accessToken: string): Promise<ObligationOption[]> {
  try {
    const response = await fetch(
      `${authEnv.restUrl}/obligations?select=id,ref,fund_classifications(name,short_code),departments(name)&order=ref.desc&limit=200`,
      { headers: authHeaders(accessToken), cache: "no-store" }
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as {
      id: string;
      ref: string;
      fund_classifications: JoinedFund | null;
      departments: JoinedDepartment | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      ref: row.ref,
      fundName: row.fund_classifications?.name ?? "",
      fundShortCode: row.fund_classifications?.short_code ?? "",
      departmentName: row.departments?.name ?? "",
    }));
  } catch {
    return [];
  }
}

/** The dashboard views scope to this same "one active fiscal year" invariant. */
export async function getActiveFiscalYearId(): Promise<string | null> {
  const years = await getFiscalYears();
  return years.find((year) => year.status === "active")?.id ?? null;
}

async function postJson(
  table: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ id?: string; error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/${table}`, {
      method: "POST",
      headers: authHeaders(accessToken, { "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return { error: errorBody?.message ?? `Failed to create ${table} record.` };
    }
    const rows = (await response.json()) as { id: string }[];
    return { id: rows[0]?.id };
  } catch {
    return { error: `Failed to create ${table} record.` };
  }
}

async function patchJson(table: string, accessToken: string, id: string, body: Record<string, unknown>): Promise<{ error?: string }> {
  try {
    const response = await fetch(`${authEnv.restUrl}/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return { error: errorBody?.message ?? `Failed to update ${table} record.` };
    }
    return {};
  } catch {
    return { error: `Failed to update ${table} record.` };
  }
}

interface NewRecordInput {
  ref: string;
  fiscalYearId: string;
  fundId: string;
  departmentId: string;
  description: string;
  amount: number;
  recordDate: string;
  status: RecordStatus;
}

export async function createAppropriation(accessToken: string, data: NewRecordInput) {
  return postJson("appropriations", accessToken, {
    ref: data.ref,
    fiscal_year_id: data.fiscalYearId,
    fund_id: data.fundId,
    department_id: data.departmentId,
    description: data.description,
    amount: data.amount,
    status: data.status,
    record_date: data.recordDate,
  });
}

export async function createAllotment(accessToken: string, data: NewRecordInput) {
  return postJson("allotments", accessToken, {
    ref: data.ref,
    fiscal_year_id: data.fiscalYearId,
    fund_id: data.fundId,
    department_id: data.departmentId,
    description: data.description,
    amount: data.amount,
    status: data.status,
    record_date: data.recordDate,
  });
}

export async function createObligation(accessToken: string, data: NewRecordInput & { payee: string }) {
  return postJson("obligations", accessToken, {
    ref: data.ref,
    fiscal_year_id: data.fiscalYearId,
    fund_id: data.fundId,
    department_id: data.departmentId,
    description: data.description,
    amount: data.amount,
    status: data.status,
    record_date: data.recordDate,
    payee: data.payee,
  });
}

export async function createLiquidation(
  accessToken: string,
  data: { ref: string; obligationId: string; description: string; amount: number; recordDate: string; status: RecordStatus }
) {
  return postJson("liquidations", accessToken, {
    ref: data.ref,
    obligation_id: data.obligationId,
    description: data.description,
    amount: data.amount,
    status: data.status,
    record_date: data.recordDate,
  });
}

interface RecordFieldsPatch {
  description?: string;
  amount?: number;
  recordDate?: string;
  status?: RecordStatus;
}

function toPatchBody(data: RecordFieldsPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.description !== undefined) body.description = data.description;
  if (data.amount !== undefined) body.amount = data.amount;
  if (data.recordDate !== undefined) body.record_date = data.recordDate;
  if (data.status !== undefined) body.status = data.status;
  return body;
}

export async function updateAppropriation(accessToken: string, id: string, data: RecordFieldsPatch) {
  return patchJson("appropriations", accessToken, id, toPatchBody(data));
}

export async function updateAllotment(accessToken: string, id: string, data: RecordFieldsPatch) {
  return patchJson("allotments", accessToken, id, toPatchBody(data));
}

export async function updateObligation(accessToken: string, id: string, data: RecordFieldsPatch & { payee?: string }) {
  const body = toPatchBody(data);
  if (data.payee !== undefined) body.payee = data.payee;
  return patchJson("obligations", accessToken, id, body);
}

export async function updateLiquidation(accessToken: string, id: string, data: RecordFieldsPatch) {
  return patchJson("liquidations", accessToken, id, toPatchBody(data));
}

export async function setObligationAttachment(accessToken: string, id: string, attachmentPath: string) {
  return patchJson("obligations", accessToken, id, { attachment_path: attachmentPath });
}
