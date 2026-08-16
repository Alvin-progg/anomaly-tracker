"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { formatPeso } from "@/app/lib/budget/format";
import { FieldInput, FieldSelect } from "./field-input";

interface RaaoEntry {
  date: string;
  reference: string;
  allotment: string;
  salaries: string;
  pera: string;
  repAllow: string;
  transAllow: string;
  lifeRet: string;
  pagIbig: string;
  philHealth: string;
}

interface RaaoDoc {
  fund: string;
  fiscalYear: string;
  annualBudget: string;
  totalSalaries: string;
  totalPera: string;
  totalLifeRet: string;
  totalPagIbig: string;
  totalPhilHealth: string;
  entries: RaaoEntry[];
}

const BLANK_ENTRY: RaaoEntry = {
  date: "",
  reference: "",
  allotment: "",
  salaries: "",
  pera: "",
  repAllow: "",
  transAllow: "",
  lifeRet: "",
  pagIbig: "",
  philHealth: "",
};

const EMPTY_DOC: RaaoDoc = {
  fund: "General Fund",
  fiscalYear: "",
  annualBudget: "",
  totalSalaries: "",
  totalPera: "",
  totalLifeRet: "",
  totalPagIbig: "",
  totalPhilHealth: "",
  entries: [BLANK_ENTRY],
};

const FUND_OPTIONS = [
  { value: "General Fund", label: "General Fund (GF)" },
  { value: "Special Education Fund", label: "Special Education Fund (SEF)" },
  { value: "20% Development Fund", label: "20% Development Fund" },
];

const cellStyle: React.CSSProperties = { border: "1px solid #000", padding: "3px 5px" };
const paperFont: React.CSSProperties = { fontFamily: '"Times New Roman", Times, serif', color: "#000" };

function num(value: string): number {
  const n = parseFloat(value.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function money(value: string | number): string {
  const n = typeof value === "string" ? num(value) : value;
  return n !== 0 ? formatPeso(n) : "—";
}

function columnTotal(entries: RaaoEntry[], key: keyof RaaoEntry): number {
  return entries.reduce((sum, entry) => sum + num(entry[key]), 0);
}

function Header({ text }: { text: string }) {
  return (
    <th style={{ ...cellStyle, background: "#1F3864", color: "#FFF", textAlign: "center", fontSize: 9 }}>{text}</th>
  );
}

export function RaaoLedgerDocument() {
  const [doc, setDoc] = useState<RaaoDoc>(EMPTY_DOC);
  const set = <K extends keyof RaaoDoc>(key: K, value: RaaoDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));
  const setEntry = (i: number, key: keyof RaaoEntry, value: string) =>
    setDoc((prev) => {
      const entries = [...prev.entries];
      entries[i] = { ...entries[i], [key]: value };
      return { ...prev, entries };
    });
  const addEntry = () => setDoc((prev) => ({ ...prev, entries: [...prev.entries, BLANK_ENTRY] }));
  const removeEntry = (i: number) => setDoc((prev) => ({ ...prev, entries: prev.entries.filter((_, idx) => idx !== i) }));

  const totalObligations = columnTotal(doc.entries, "allotment");

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldSelect label="Fund Classification" value={doc.fund} onChange={(v) => set("fund", v)} options={FUND_OPTIONS} />
            <FieldInput label="Fiscal Year" value={doc.fiscalYear} onChange={(v) => set("fiscalYear", v)} placeholder="2025" />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Annual Budget by PS Category</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput
              label="Total Annual Budget (₱)"
              value={doc.annualBudget}
              onChange={(v) => set("annualBudget", v)}
              placeholder="Total appropriation for the year"
            />
            <div className="grid grid-cols-2 gap-2">
              <FieldInput label="Salaries (₱)" value={doc.totalSalaries} onChange={(v) => set("totalSalaries", v)} placeholder="0.00" />
              <FieldInput label="PERA (₱)" value={doc.totalPera} onChange={(v) => set("totalPera", v)} placeholder="0.00" />
              <FieldInput
                label="Life & Retirement Ins. (₱)"
                value={doc.totalLifeRet}
                onChange={(v) => set("totalLifeRet", v)}
                placeholder="0.00"
              />
              <FieldInput label="Pag-IBIG (₱)" value={doc.totalPagIbig} onChange={(v) => set("totalPagIbig", v)} placeholder="0.00" />
              <FieldInput
                label="PhilHealth (₱)"
                value={doc.totalPhilHealth}
                onChange={(v) => set("totalPhilHealth", v)}
                placeholder="0.00"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Obligation / Allotment Transactions</SectionTitle>
          <div className="flex flex-col gap-3">
            {doc.entries.map((entry, i) => (
              <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#6B7A99]">Entry {i + 1}</span>
                  {doc.entries.length > 1 && (
                    <Btn variant="ghost" small onClick={() => removeEntry(i)}>
                      Remove
                    </Btn>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="Date" type="date" value={entry.date} onChange={(v) => setEntry(i, "date", v)} />
                  <FieldInput
                    label="Reference (AO/AA Number)"
                    value={entry.reference}
                    onChange={(v) => setEntry(i, "reference", v)}
                    placeholder="100-25-01-XXXX"
                  />
                </div>
                <FieldInput
                  label="Allotment / Obligation Amount (₱)"
                  value={entry.allotment}
                  onChange={(v) => setEntry(i, "allotment", v)}
                  placeholder="Total amount"
                />
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="Salaries (₱)" value={entry.salaries} onChange={(v) => setEntry(i, "salaries", v)} placeholder="0.00" />
                  <FieldInput label="PERA (₱)" value={entry.pera} onChange={(v) => setEntry(i, "pera", v)} placeholder="0.00" />
                  <FieldInput
                    label="Rep. Allow. (₱)"
                    value={entry.repAllow}
                    onChange={(v) => setEntry(i, "repAllow", v)}
                    placeholder="0.00"
                  />
                  <FieldInput
                    label="Trans. Allow. (₱)"
                    value={entry.transAllow}
                    onChange={(v) => setEntry(i, "transAllow", v)}
                    placeholder="0.00"
                  />
                  <FieldInput
                    label="Life & Ret. (₱)"
                    value={entry.lifeRet}
                    onChange={(v) => setEntry(i, "lifeRet", v)}
                    placeholder="0.00"
                  />
                  <FieldInput label="Pag-IBIG (₱)" value={entry.pagIbig} onChange={(v) => setEntry(i, "pagIbig", v)} placeholder="0.00" />
                  <FieldInput
                    label="PhilHealth (₱)"
                    value={entry.philHealth}
                    onChange={(v) => setEntry(i, "philHealth", v)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
          <Btn variant="ghost" small onClick={addEntry} className="mt-3">
            + Add Row
          </Btn>
        </SectionCard>

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <div>
        <div className="no-print text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">Live Preview</div>
        <div className="print-area bg-white border border-[#D1D9E6] rounded-lg overflow-hidden">
          <div style={{ ...paperFont, padding: "28px 20px", fontSize: 10, background: "#FFF" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Republic of the Philippines</div>
              <div>Province of Batangas · Municipality of San Pascual</div>
              <div>Municipal Budget Office</div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Registry of Appropriations, Allotments and Obligations
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>
                Personal Services — {doc.fund} — FY {doc.fiscalYear || "____"}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 9, width: "100%", minWidth: 760 }}>
                <thead>
                  <tr>
                    <Header text="Date" />
                    <Header text="Reference (AO/AA)" />
                    <Header text="Allotment" />
                    <Header text="Bal. of Appropriation" />
                    <Header text="Salaries" />
                    <Header text="PERA" />
                    <Header text="Rep. Allow." />
                    <Header text="Trans. Allow." />
                    <Header text="Life & Ret." />
                    <Header text="Pag-IBIG" />
                    <Header text="PhilHealth" />
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ fontWeight: 700, background: "#E8ECF1" }}>
                    <td style={cellStyle}>—</td>
                    <td style={cellStyle}>ANNUAL BUDGET CY {doc.fiscalYear || "____"}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.annualBudget)}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.annualBudget)}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.totalSalaries)}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.totalPera)}</td>
                    <td style={cellStyle}>—</td>
                    <td style={cellStyle}>—</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.totalLifeRet)}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.totalPagIbig)}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(doc.totalPhilHealth)}</td>
                  </tr>

                  {doc.entries.map((entry, i) => (
                    <tr key={i}>
                      <td style={cellStyle}>{entry.date || " "}</td>
                      <td style={cellStyle}>{entry.reference || " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.allotment ? money(entry.allotment) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.allotment ? money(entry.allotment) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.salaries ? money(entry.salaries) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.pera ? money(entry.pera) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.repAllow ? money(entry.repAllow) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.transAllow ? money(entry.transAllow) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.lifeRet ? money(entry.lifeRet) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.pagIbig ? money(entry.pagIbig) : " "}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{entry.philHealth ? money(entry.philHealth) : " "}</td>
                    </tr>
                  ))}

                  <tr style={{ fontWeight: 700, background: "#1F3864", color: "#FFF" }}>
                    <td style={cellStyle}>—</td>
                    <td style={cellStyle}>TOTAL OBLIGATIONS</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(totalObligations)}</td>
                    <td style={cellStyle}>—</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "salaries"))}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "pera"))}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "repAllow"))}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "transAllow"))}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "lifeRet"))}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "pagIbig"))}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{money(columnTotal(doc.entries, "philHealth"))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, fontSize: 10 }}>
              <div>
                <div style={{ marginBottom: 28 }}>Prepared by:</div>
                <div style={{ borderTop: "1px solid #000", paddingTop: 4 }}>
                  <div style={{ fontWeight: 700 }}>________________________________</div>
                  <div>Budget Personnel</div>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 28 }}>Verified by:</div>
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
