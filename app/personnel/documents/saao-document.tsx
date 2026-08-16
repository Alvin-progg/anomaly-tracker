"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { formatPeso } from "@/app/lib/budget/format";
import { FieldInput, FieldSelect } from "./field-input";

interface SaaoRow {
  activity: string;
  appropriation: string;
  allotment: string;
  obligation: string;
}

interface SaaoDoc {
  asOf: string;
  office: string;
  fund: "current" | "continuing" | "supplemental";
  mooeItems: SaaoRow[];
  coItems: SaaoRow[];
}

const BLANK_ROW: SaaoRow = { activity: "", appropriation: "", allotment: "", obligation: "" };

const EMPTY_DOC: SaaoDoc = {
  asOf: "",
  office: "",
  fund: "current",
  mooeItems: [BLANK_ROW],
  coItems: [BLANK_ROW],
};

const FUND_OPTIONS = [
  { value: "current", label: "Current Legislative Appropriation" },
  { value: "continuing", label: "Continuing Appropriations" },
  { value: "supplemental", label: "Supplemental Budget" },
];

const FUND_LABEL: Record<SaaoDoc["fund"], string> = {
  current: "Current Legislative Appropriation",
  continuing: "Continuing Appropriations",
  supplemental: "Supplemental Budget",
};

const cellStyle: React.CSSProperties = { border: "1px solid #1F3864", padding: "5px 8px" };
const paperFont: React.CSSProperties = { fontFamily: '"Times New Roman", Times, serif', color: "#000" };

function num(value: string): number {
  const n = parseFloat(value.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function money(value: number): string {
  return value !== 0 ? formatPeso(value) : "—";
}

function sumOf(rows: SaaoRow[], key: keyof SaaoRow): number {
  return rows.reduce((sum, row) => sum + num(row[key]), 0);
}

function balanceAllotment(rows: SaaoRow[]): number {
  return rows.reduce((sum, row) => sum + (num(row.allotment) - num(row.obligation)), 0);
}

function RowEditor({
  rows,
  onChange,
  title,
}: {
  rows: SaaoRow[];
  onChange: (rows: SaaoRow[]) => void;
  title: string;
}) {
  const setRow = (i: number, key: keyof SaaoRow, value: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const add = () => onChange([...rows, BLANK_ROW]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <SectionCard>
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#6B7A99]">Entry {i + 1}</span>
              {rows.length > 1 && (
                <Btn variant="ghost" small onClick={() => remove(i)}>
                  Remove
                </Btn>
              )}
            </div>
            <FieldInput
              label="Program / Project / Activity"
              value={row.activity}
              onChange={(v) => setRow(i, "activity", v)}
              placeholder="e.g. Demolition of School Building – Banaba ES"
            />
            <div className="grid grid-cols-3 gap-2">
              <FieldInput
                label="Appropriation (₱)"
                value={row.appropriation}
                onChange={(v) => setRow(i, "appropriation", v)}
                placeholder="0.00"
              />
              <FieldInput label="Allotment (₱)" value={row.allotment} onChange={(v) => setRow(i, "allotment", v)} placeholder="0.00" />
              <FieldInput
                label="Obligation (₱)"
                value={row.obligation}
                onChange={(v) => setRow(i, "obligation", v)}
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
      </div>
      <Btn variant="ghost" small onClick={add} className="mt-3">
        + Add Row
      </Btn>
    </SectionCard>
  );
}

function sectionRows(rows: SaaoRow[], label: string) {
  const totalApp = sumOf(rows, "appropriation");
  const totalAll = sumOf(rows, "allotment");
  const totalObl = sumOf(rows, "obligation");
  const totalBal = balanceAllotment(rows);

  return (
    <>
      <tr>
        <td colSpan={6} style={{ ...cellStyle, fontWeight: 700, background: "#E8ECF1", paddingLeft: 8 }}>
          {label}
        </td>
      </tr>
      {rows.map((row, i) => {
        const bal = num(row.allotment) - num(row.obligation);
        return (
          <tr key={i}>
            <td style={{ ...cellStyle, paddingLeft: 16 }}>{row.activity || " "}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>{money(num(row.appropriation))}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>{money(num(row.allotment))}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>{money(num(row.obligation))}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>{money(bal)}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>—</td>
          </tr>
        );
      })}
      <tr style={{ fontWeight: 700, background: "#F0F2F5" }}>
        <td style={{ ...cellStyle, paddingLeft: 8 }}>TOTAL {label.toUpperCase()}</td>
        <td style={{ ...cellStyle, textAlign: "right" }}>{money(totalApp)}</td>
        <td style={{ ...cellStyle, textAlign: "right" }}>{money(totalAll)}</td>
        <td style={{ ...cellStyle, textAlign: "right" }}>{money(totalObl)}</td>
        <td style={{ ...cellStyle, textAlign: "right" }}>{money(totalBal)}</td>
        <td style={{ ...cellStyle, textAlign: "right" }}>—</td>
      </tr>
    </>
  );
}

export function SaaoDocument() {
  const [doc, setDoc] = useState<SaaoDoc>(EMPTY_DOC);
  const set = <K extends keyof SaaoDoc>(key: K, value: SaaoDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));

  const allRows = [...doc.mooeItems, ...doc.coItems];
  const grandApp = sumOf(allRows, "appropriation");
  const grandAll = sumOf(allRows, "allotment");
  const grandObl = sumOf(allRows, "obligation");
  const grandBal = balanceAllotment(allRows);

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="As of Date" type="date" value={doc.asOf} onChange={(v) => set("asOf", v)} />
            <FieldSelect
              label="Appropriation Type"
              value={doc.fund}
              onChange={(v) => set("fund", v as SaaoDoc["fund"])}
              options={FUND_OPTIONS}
            />
            <FieldInput
              label="Office / Department"
              value={doc.office}
              onChange={(v) => set("office", v)}
              placeholder="e.g. Elementary Education, General Administration"
            />
          </div>
        </SectionCard>

        <RowEditor
          rows={doc.mooeItems}
          onChange={(rows) => set("mooeItems", rows)}
          title="Maintenance & Other Operating Expenses (MOOE)"
        />
        <RowEditor rows={doc.coItems} onChange={(rows) => set("coItems", rows)} title="Capital Outlay (CO)" />

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <div>
        <div className="no-print text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">Live Preview</div>
        <div className="print-area bg-white border border-[#D1D9E6] rounded-lg overflow-hidden">
          <div style={{ ...paperFont, padding: "28px 32px", fontSize: 10, background: "#FFF" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Republic of the Philippines</div>
              <div>Province of Batangas · Municipality of San Pascual</div>
              <div>Municipal Budget Office</div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Status of Appropriations, Allotments and Obligations
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>({FUND_LABEL[doc.fund]})</div>
              <div style={{ marginTop: 4 }}>As of {doc.asOf || "___________"}</div>
            </div>

            <div style={{ marginBottom: 10, fontSize: 11 }}>
              <strong>Office/Department:</strong> {doc.office || "___________"}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1F3864", color: "#FFF" }}>
                  <th style={{ ...cellStyle, textAlign: "left", width: "34%" }}>Function / Program / Project / Activity</th>
                  <th style={{ ...cellStyle, textAlign: "right", width: "13%" }}>Appropriations</th>
                  <th style={{ ...cellStyle, textAlign: "right", width: "13%" }}>Allotment</th>
                  <th style={{ ...cellStyle, textAlign: "right", width: "13%" }}>Obligation</th>
                  <th style={{ ...cellStyle, textAlign: "right", width: "13%" }}>Balance – Allotment</th>
                  <th style={{ ...cellStyle, textAlign: "right", width: "14%" }}>Balance – Appropriation</th>
                </tr>
              </thead>
              <tbody>
                {sectionRows(doc.mooeItems, "Maintenance & Other Operating Expenses")}
                {sectionRows(doc.coItems, "Capital Outlay")}
                <tr style={{ fontWeight: 700, background: "#1F3864", color: "#FFF" }}>
                  <td style={cellStyle}>SUBTOTAL</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{money(grandApp)}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{money(grandAll)}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{money(grandObl)}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{money(grandBal)}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>—</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, fontSize: 10 }}>
              <div>
                <div style={{ marginBottom: 28 }}>Prepared by:</div>
                <div style={{ borderTop: "1px solid #000", paddingTop: 4 }}>
                  <div style={{ fontWeight: 700 }}>________________________________</div>
                  <div>Budget Personnel</div>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 28 }}>Certified Correct:</div>
                <div style={{ borderTop: "1px solid #000", paddingTop: 4 }}>
                  <div style={{ fontWeight: 700 }}>Merlita M. Yuncion</div>
                  <div>Municipal Budget Officer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
