"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { formatPeso } from "@/app/lib/budget/format";
import { FieldInput } from "./field-input";

interface AbcItem {
  description: string;
  qty: string;
  unit: string;
  unitCost: string;
}

interface AbcDoc {
  station: string;
  subject: string;
  date: string;
  items: AbcItem[];
  preparedBy: string;
  preparedByPosition: string;
  reviewedBy: string;
  reviewedByPosition: string;
  approvedBy: string;
  approvedByPosition: string;
}

const BLANK_ITEM: AbcItem = { description: "", qty: "", unit: "", unitCost: "" };

const EMPTY_DOC: AbcDoc = {
  station: "",
  subject: "",
  date: "",
  items: [BLANK_ITEM],
  preparedBy: "",
  preparedByPosition: "",
  reviewedBy: "",
  reviewedByPosition: "",
  approvedBy: "",
  approvedByPosition: "",
};

const MIN_ROWS = 5;

function itemTotal(item: AbcItem): number {
  const qty = parseFloat(item.qty);
  const unitCost = parseFloat(item.unitCost.replace(/,/g, ""));
  if (isNaN(qty) || isNaN(unitCost)) return NaN;
  return qty * unitCost;
}

function totalCell(item: AbcItem): string {
  const n = itemTotal(item);
  return isNaN(n) ? "—" : formatPeso(n);
}

const cellStyle: React.CSSProperties = { border: "1px solid #1F3864", padding: "5px 8px" };
const paperFont: React.CSSProperties = { fontFamily: '"Times New Roman", Times, serif', color: "#000" };

export function AbcDocument() {
  const [doc, setDoc] = useState<AbcDoc>(EMPTY_DOC);

  const set = <K extends keyof AbcDoc>(key: K, value: AbcDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));
  const setItem = (i: number, key: keyof AbcItem, value: string) =>
    setDoc((prev) => {
      const items = [...prev.items];
      items[i] = { ...items[i], [key]: value };
      return { ...prev, items };
    });
  const addItem = () => setDoc((prev) => ({ ...prev, items: [...prev.items, BLANK_ITEM] }));
  const removeItem = (i: number) => setDoc((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));

  const total = doc.items.reduce((sum, item) => {
    const n = itemTotal(item);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const fillerRows = Math.max(0, MIN_ROWS - doc.items.length);

  const signatories = [
    { label: "Prepared / Submitted by", name: doc.preparedBy, position: doc.preparedByPosition },
    { label: "Reviewed as to Appropriation", name: doc.reviewedBy, position: doc.reviewedByPosition },
    { label: "Approved by", name: doc.approvedBy, position: doc.approvedByPosition },
  ];

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="Station" value={doc.station} onChange={(v) => set("station", v)} placeholder="e.g. MBO" />
            <FieldInput label="Date" type="date" value={doc.date} onChange={(v) => set("date", v)} />
            <FieldInput
              label="Subject / Description of Procurement"
              value={doc.subject}
              onChange={(v) => set("subject", v)}
              placeholder="e.g. Office Supplies Expense / Other Supplies Expense"
            />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Item List</SectionTitle>
          <div className="flex flex-col gap-3">
            {doc.items.map((item, i) => (
              <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#6B7A99]">Item {i + 1}</span>
                  {doc.items.length > 1 && (
                    <Btn variant="ghost" small onClick={() => removeItem(i)}>
                      Remove
                    </Btn>
                  )}
                </div>
                <FieldInput
                  label="Item Description"
                  value={item.description}
                  onChange={(v) => setItem(i, "description", v)}
                  placeholder="e.g. Trash bag large"
                />
                <FieldInput label="Quantity" value={item.qty} onChange={(v) => setItem(i, "qty", v)} placeholder="5" />
                <FieldInput label="Unit" value={item.unit} onChange={(v) => setItem(i, "unit", v)} placeholder="packs / pcs / bottles" />
                <FieldInput
                  label="Unit Cost (₱)"
                  value={item.unitCost}
                  onChange={(v) => setItem(i, "unitCost", v)}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          <Btn variant="ghost" small onClick={addItem} className="mt-3">
            + Add Row
          </Btn>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Signatories</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="Prepared by" value={doc.preparedBy} onChange={(v) => set("preparedBy", v)} placeholder="Full name" />
            <FieldInput label="Position" value={doc.preparedByPosition} onChange={(v) => set("preparedByPosition", v)} />
            <FieldInput label="Reviewed by" value={doc.reviewedBy} onChange={(v) => set("reviewedBy", v)} />
            <FieldInput label="Position" value={doc.reviewedByPosition} onChange={(v) => set("reviewedByPosition", v)} />
            <FieldInput label="Approved by" value={doc.approvedBy} onChange={(v) => set("approvedBy", v)} />
            <FieldInput label="Position" value={doc.approvedByPosition} onChange={(v) => set("approvedByPosition", v)} />
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
              <div>Province of Batangas · Municipality of San Pascual</div>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Approved Budget for the Contract
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>(ABC)</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", marginBottom: 14 }}>
              <div>
                <strong>Station:</strong> {doc.station || "________________"}
              </div>
              <div>
                <strong>Date:</strong> {doc.date || "________________"}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Subject:</strong> {doc.subject || "________________"}
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
              <thead>
                <tr style={{ background: "#1F3864", color: "#FFF" }}>
                  <th style={{ ...cellStyle, width: "8%" }}>Item No.</th>
                  <th style={{ ...cellStyle, width: "34%", textAlign: "left" }}>Description</th>
                  <th style={{ ...cellStyle, width: "10%" }}>Qty.</th>
                  <th style={{ ...cellStyle, width: "14%" }}>Unit</th>
                  <th style={{ ...cellStyle, width: "17%", textAlign: "right" }}>Unit Cost</th>
                  <th style={{ ...cellStyle, width: "17%", textAlign: "right" }}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{i + 1}</td>
                    <td style={cellStyle}>{item.description || " "}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{item.qty || " "}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{item.unit || " "}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {item.unitCost.trim() === "" || isNaN(parseFloat(item.unitCost.replace(/,/g, "")))
                        ? "—"
                        : formatPeso(parseFloat(item.unitCost.replace(/,/g, "")))}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{totalCell(item)}</td>
                  </tr>
                ))}
                {Array.from({ length: fillerRows }).map((_, i) => (
                  <tr key={`filler-${i}`}>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                    <td style={cellStyle}>&nbsp;</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ ...cellStyle, textAlign: "right", fontWeight: 700, background: "#F0F2F5" }}>
                    TOTAL
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700 }}>{total > 0 ? formatPeso(total) : "—"}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {signatories.map((s) => (
                <div key={s.label} style={{ borderTop: "2px solid #000", paddingTop: 4 }}>
                  <div style={{ fontWeight: 700, marginBottom: 16 }}>{s.label}:</div>
                  <div style={{ borderTop: "1px solid #000", paddingTop: 4, marginTop: 28 }}>
                    <div style={{ fontWeight: 700 }}>{s.name || "________________________________"}</div>
                    <div>{s.position}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
