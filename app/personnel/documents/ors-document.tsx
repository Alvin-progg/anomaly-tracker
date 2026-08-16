"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { formatPeso } from "@/app/lib/budget/format";
import { FieldInput } from "./field-input";

interface OrsItem {
  particulars: string;
  fpp: string;
  accountCode: string;
  amount: string;
}

interface OrsDoc {
  no: string;
  date: string;
  payee: string;
  office: string;
  address: string;
  responsibilityCenter: string;
  certifiedBy: string;
  certifiedByTitle: string;
  budgetOfficer: string;
  items: OrsItem[];
}

const BLANK_ITEM: OrsItem = { particulars: "", fpp: "", accountCode: "", amount: "" };

const EMPTY_DOC: OrsDoc = {
  no: "",
  date: "",
  payee: "",
  office: "",
  address: "",
  responsibilityCenter: "",
  certifiedBy: "",
  certifiedByTitle: "",
  budgetOfficer: "",
  items: [BLANK_ITEM],
};

const MIN_ROWS = 6;

function amountCell(value: string): string {
  const n = parseFloat(value.replace(/,/g, ""));
  return value.trim() === "" || isNaN(n) ? "—" : formatPeso(n);
}

const cellStyle: React.CSSProperties = { border: "1px solid #1F3864", padding: "5px 8px" };
const paperFont: React.CSSProperties = { fontFamily: '"Times New Roman", Times, serif', color: "#000" };

export function OrsDocument() {
  const [doc, setDoc] = useState<OrsDoc>(EMPTY_DOC);

  const set = <K extends keyof OrsDoc>(key: K, value: OrsDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));
  const setItem = (i: number, key: keyof OrsItem, value: string) =>
    setDoc((prev) => {
      const items = [...prev.items];
      items[i] = { ...items[i], [key]: value };
      return { ...prev, items };
    });
  const addItem = () => setDoc((prev) => ({ ...prev, items: [...prev.items, BLANK_ITEM] }));
  const removeItem = (i: number) => setDoc((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));

  const total = doc.items.reduce((sum, item) => {
    const n = parseFloat(item.amount.replace(/,/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const fillerRows = Math.max(0, MIN_ROWS - doc.items.length);

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="ORS Number" value={doc.no} onChange={(v) => set("no", v)} placeholder="100-26-07-XXXX" />
            <FieldInput label="Date" type="date" value={doc.date} onChange={(v) => set("date", v)} />
            <FieldInput
              label="Payee / Supplier Name"
              value={doc.payee}
              onChange={(v) => set("payee", v)}
              placeholder="Full name of payee or supplier"
            />
            <FieldInput label="Office" value={doc.office} onChange={(v) => set("office", v)} placeholder="e.g. OM, MBO" />
            <FieldInput
              label="Responsibility Center"
              value={doc.responsibilityCenter}
              onChange={(v) => set("responsibilityCenter", v)}
              placeholder="e.g. OM"
            />
            <FieldInput label="Address" value={doc.address} onChange={(v) => set("address", v)} placeholder="e.g. Bauan, Batangas" />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Particulars / Line Items</SectionTitle>
          <div className="flex flex-col gap-3">
            {doc.items.map((item, i) => (
              <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#6B7A99]">Line Item {i + 1}</span>
                  {doc.items.length > 1 && (
                    <Btn variant="ghost" small onClick={() => removeItem(i)}>
                      Remove
                    </Btn>
                  )}
                </div>
                <FieldInput
                  label="Particulars (Expense Description)"
                  value={item.particulars}
                  onChange={(v) => setItem(i, "particulars", v)}
                  placeholder="e.g. Other Supplies Expense"
                />
                <FieldInput label="F.P.P." value={item.fpp} onChange={(v) => setItem(i, "fpp", v)} placeholder="e.g. 1011" />
                <FieldInput
                  label="Account Code"
                  value={item.accountCode}
                  onChange={(v) => setItem(i, "accountCode", v)}
                  placeholder="50203990"
                />
                <FieldInput label="Amount (₱)" value={item.amount} onChange={(v) => setItem(i, "amount", v)} placeholder="0.00" />
              </div>
            ))}
          </div>
          <Btn variant="ghost" small onClick={addItem} className="mt-3">
            + Add Row
          </Btn>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Certifications</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput
              label="Certified by (Requesting Office)"
              value={doc.certifiedBy}
              onChange={(v) => set("certifiedBy", v)}
            />
            <FieldInput label="Title / Position" value={doc.certifiedByTitle} onChange={(v) => set("certifiedByTitle", v)} />
            <FieldInput
              label="Budget Officer (Certification B)"
              value={doc.budgetOfficer}
              onChange={(v) => set("budgetOfficer", v)}
            />
          </div>
        </SectionCard>

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <div>
        <div className="no-print text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">Live Preview</div>
        <div className="print-area bg-white border border-[#D1D9E6] rounded-lg overflow-hidden">
          <div style={{ ...paperFont, padding: "28px 32px", fontSize: 11, background: "#FFF" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Republic of the Philippines</div>
              <div style={{ fontSize: 11 }}>Province of Batangas</div>
              <div style={{ fontSize: 11 }}>Municipality of San Pascual</div>
              <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Obligation Request
              </div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>(ORS)</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", marginBottom: 14 }}>
              <div>
                <strong>ORS No.:</strong> {doc.no || "________________"}
              </div>
              <div>
                <strong>Date:</strong> {doc.date || "________________"}
              </div>
              <div>
                <strong>Payee:</strong> {doc.payee || "________________"}
              </div>
              <div>
                <strong>Office:</strong> {doc.office || "________________"}
              </div>
              <div>
                <strong>Responsibility Center:</strong> {doc.responsibilityCenter || "________________"}
              </div>
              <div>
                <strong>Address:</strong> {doc.address || "________________"}
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
              <thead>
                <tr style={{ background: "#1F3864", color: "#FFF" }}>
                  <th style={{ ...cellStyle, width: "48%", textAlign: "left" }}>Particulars</th>
                  <th style={{ ...cellStyle, width: "14%" }}>F.P.P.</th>
                  <th style={{ ...cellStyle, width: "22%" }}>Account Code</th>
                  <th style={{ ...cellStyle, width: "16%", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, i) => (
                  <tr key={i}>
                    <td style={cellStyle}>{item.particulars || " "}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{item.fpp || " "}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{item.accountCode || " "}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{amountCell(item.amount)}</td>
                  </tr>
                ))}
                {Array.from({ length: fillerRows }).map((_, i) => (
                  <tr key={`filler-${i}`}>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ ...cellStyle, textAlign: "right", fontWeight: 700, background: "#F0F2F5" }}>
                    Total
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700 }}>{total > 0 ? formatPeso(total) : "—"}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, textDecoration: "underline" }}>A. Certified</div>
                <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                  Charges to Appropriation/allotment necessary, lawful and under my direct supervision. Supporting documents
                  valid, proper and legal.
                </div>
                <div style={{ marginTop: 28, borderTop: "1px solid #000", paddingTop: 4 }}>
                  <div style={{ fontWeight: 700 }}>{doc.certifiedBy || "________________________________"}</div>
                  <div>{doc.certifiedByTitle || "Head, Requesting Office / Authorized Representative"}</div>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, textDecoration: "underline" }}>B. Certified</div>
                <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                  Existence of available appropriation certified correct and charges to appropriations/allotment valid.
                </div>
                <div style={{ marginTop: 28, borderTop: "1px solid #000", paddingTop: 4 }}>
                  <div style={{ fontWeight: 700 }}>{doc.budgetOfficer || "________________________________"}</div>
                  <div>Head, Budget Unit / Authorized Representative</div>
                  <div style={{ marginTop: 4 }}>Municipal Budget Officer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
