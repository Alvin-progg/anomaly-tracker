"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { FieldInput } from "./field-input";
import {
  MUNICIPALITY,
  PaperSheet,
  SIGNATORIES,
  amountOrBlank,
  amountOrDash,
  cell,
  cellCenter,
  cellHead,
  cellRight,
  parseAmount,
} from "@/app/components/ui/paper";

/**
 * Obligation Request.
 *
 * From `sample/Obligation Request.png`. The whole form is one ruled box — the letterhead, the
 * payee block, the particulars table and both certifications are rows of a single table, not
 * free-floating sections, so everything is laid out over one 12-column grid (see COL_WIDTHS).
 *
 * Two details worth not "fixing":
 *
 *  - Certification B on the printed form reads "Existence of avaliable appropriation". That
 *    spelling is the municipality's pre-printed form, so it is what we reproduce. Correcting it
 *    would make our output differ from every ORS already on file.
 *  - There is no date field in the header. Date appears only as the last row of each certification
 *    block, filled in by hand when signed.
 *
 * The seal is a placeholder cell until an asset lands at public/san-pascual-seal.png; the cell is
 * kept at the right size so the rest of the layout is already correct and the form can be run on
 * pre-sealed stock in the meantime.
 */

interface OrsItem {
  particulars: string;
  fpp: string;
  accountCode: string;
  amount: string;
}

interface OrsDoc {
  no: string;
  payee: string;
  office: string;
  address: string;
  responsibilityCenter: string;
  certifiedByName: string;
  certifiedByPosition: string;
  budgetOfficerName: string;
  budgetOfficerPosition: string;
  items: OrsItem[];
}

const BLANK_ITEM: OrsItem = { particulars: "", fpp: "", accountCode: "", amount: "" };

const EMPTY_DOC: OrsDoc = {
  no: "",
  payee: "",
  office: "",
  address: "",
  responsibilityCenter: "",
  certifiedByName: SIGNATORIES.mayor.name,
  certifiedByPosition: SIGNATORIES.mayor.position,
  budgetOfficerName: SIGNATORIES.budgetOfficer.name,
  budgetOfficerPosition: SIGNATORIES.budgetOfficer.position,
  items: [BLANK_ITEM],
};

/** The particulars block runs most of the page height on the printed form. */
const MIN_ITEM_ROWS = 10;

/**
 * Responsibility Center | Particulars | F.P.P | Account Code | Amount, as 2 | 5 | 1 | 2 | 2 of a
 * 12-column grid. The certifications split 6 | 6, which lands on a different boundary — that is
 * how the form prints.
 */
const COL_WIDTHS = ["9%", "8%", "8.4%", "8.4%", "8.4%", "8.4%", "8.4%", "8%", "8.5%", "8.5%", "8%", "8%"];

const labelCell: React.CSSProperties = { ...cell, fontWeight: 700, fontSize: 10 };

export function OrsDocument() {
  const [doc, setDoc] = useState<OrsDoc>(EMPTY_DOC);

  const set = <K extends keyof OrsDoc>(key: K, value: OrsDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));
  const setItem = (i: number, key: keyof OrsItem, value: string) =>
    setDoc((prev) => ({ ...prev, items: prev.items.map((item, idx) => (idx === i ? { ...item, [key]: value } : item)) }));

  const total = doc.items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const fillerCount = Math.max(0, MIN_ITEM_ROWS - doc.items.length);
  const itemRowCount = doc.items.length + fillerCount;

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="Obligation Request No." value={doc.no} onChange={(v) => set("no", v)} placeholder="100-26-07-1965" />
            <FieldInput
              label="Payee"
              value={doc.payee}
              onChange={(v) => set("payee", v)}
              placeholder="e.g. Blazing Style Printing Services"
            />
            <FieldInput label="Office" value={doc.office} onChange={(v) => set("office", v)} placeholder="e.g. OM" />
            <FieldInput label="Address" value={doc.address} onChange={(v) => set("address", v)} placeholder="e.g. Bauan Batangas" />
            <FieldInput
              label="Responsibility Center"
              value={doc.responsibilityCenter}
              onChange={(v) => set("responsibilityCenter", v)}
              placeholder="e.g. OM"
            />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Particulars</SectionTitle>
          <div className="flex flex-col gap-3">
            {doc.items.map((item, i) => (
              <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#6B7A99]">Line Item {i + 1}</span>
                  {doc.items.length > 1 && (
                    <Btn variant="ghost" small onClick={() => set("items", doc.items.filter((_, idx) => idx !== i))}>
                      Remove
                    </Btn>
                  )}
                </div>
                <FieldInput
                  label="Particulars"
                  value={item.particulars}
                  onChange={(v) => setItem(i, "particulars", v)}
                  placeholder="e.g. Other Supplies Expense"
                />
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="F.P.P" value={item.fpp} onChange={(v) => setItem(i, "fpp", v)} placeholder="1011" />
                  <FieldInput
                    label="Account Code"
                    value={item.accountCode}
                    onChange={(v) => setItem(i, "accountCode", v)}
                    placeholder="50203990"
                  />
                </div>
                <FieldInput label="Amount" value={item.amount} onChange={(v) => setItem(i, "amount", v)} placeholder="0.00" />
              </div>
            ))}
          </div>
          <Btn variant="ghost" small onClick={() => set("items", [...doc.items, BLANK_ITEM])} className="mt-3">
            + Add Row
          </Btn>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Certifications</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="A — Printed Name" value={doc.certifiedByName} onChange={(v) => set("certifiedByName", v)} />
            <FieldInput label="A — Position" value={doc.certifiedByPosition} onChange={(v) => set("certifiedByPosition", v)} />
            <FieldInput label="B — Printed Name" value={doc.budgetOfficerName} onChange={(v) => set("budgetOfficerName", v)} />
            <FieldInput label="B — Position" value={doc.budgetOfficerPosition} onChange={(v) => set("budgetOfficerPosition", v)} />
          </div>
        </SectionCard>

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <PaperSheet>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <colgroup>
            {COL_WIDTHS.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>
          <tbody>
            {/* Letterhead */}
            <tr>
              <td style={{ ...cellCenter, height: 62 }} colSpan={2}>
                {/* Placeholder for public/san-pascual-seal.png — see the file header. */}
                <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid #000", margin: "0 auto" }} />
              </td>
              <td style={{ ...cellCenter, lineHeight: 1.5 }} colSpan={10}>
                <div>{MUNICIPALITY.republic}</div>
                <div style={{ fontWeight: 700 }}>{MUNICIPALITY.province}</div>
                <div style={{ fontWeight: 700 }}>{MUNICIPALITY.municipality}</div>
              </td>
            </tr>

            {/* Title + number */}
            <tr>
              <td style={{ ...cellCenter, fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", padding: "6px" }} colSpan={9}>
                OBLIGATION REQUEST
              </td>
              <td style={{ ...cell, verticalAlign: "top" }} colSpan={3} rowSpan={2}>
                <div>No.</div>
                <div style={{ textAlign: "center", fontSize: 12, marginTop: 6 }}>{doc.no}</div>
              </td>
            </tr>

            <tr>
              <td style={{ ...labelCell, textAlign: "center" }} colSpan={2}>
                Payee
              </td>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={7}>
                {doc.payee.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style={{ ...labelCell, textAlign: "center" }} colSpan={2}>
                Office
              </td>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={10}>
                {doc.office.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style={{ ...labelCell, textAlign: "center" }} colSpan={2}>
                Address
              </td>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={10}>
                {doc.address.toUpperCase()}
              </td>
            </tr>

            {/* Particulars table header */}
            <tr>
              <td style={{ ...cellHead, fontSize: 9, lineHeight: 1.2 }} colSpan={2}>
                Responsibility
                <br />
                Center
              </td>
              <td style={cellHead} colSpan={5}>
                Particulars
              </td>
              <td style={cellHead}>F.P.P</td>
              <td style={cellHead} colSpan={2}>
                Account Code
              </td>
              <td style={cellHead} colSpan={2}>
                Amount
              </td>
            </tr>

            {doc.items.map((item, i) => (
              <tr key={i}>
                {i === 0 && (
                  <td style={{ ...cellCenter, verticalAlign: "top" }} colSpan={2} rowSpan={itemRowCount}>
                    {doc.responsibilityCenter.toUpperCase()}
                  </td>
                )}
                <td style={{ ...cell, height: 22 }} colSpan={5}>
                  {item.particulars}
                </td>
                <td style={cellCenter}>{item.fpp}</td>
                <td style={cellCenter} colSpan={2}>
                  {item.accountCode}
                </td>
                <td style={cellRight} colSpan={2}>
                  {amountOrBlank(item.amount)}
                </td>
              </tr>
            ))}
            {Array.from({ length: fillerCount }).map((_, i) => (
              <tr key={`filler-${i}`}>
                <td style={{ ...cell, height: 22 }} colSpan={5}>
                  &nbsp;
                </td>
                <td style={cell} />
                <td style={cell} colSpan={2} />
                <td style={cell} colSpan={2} />
              </tr>
            ))}

            <tr>
              <td style={cell} colSpan={8} />
              <td style={{ ...cellCenter, fontWeight: 700 }} colSpan={2}>
                Total
              </td>
              <td style={{ ...cellRight, fontWeight: 700 }} colSpan={2}>
                {amountOrDash(total)}
              </td>
            </tr>

            {/* Certifications — A and B side by side, splitting the grid 6 | 6 */}
            <tr>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={6}>
                A. Certified
              </td>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={6}>
                B. Certified
              </td>
            </tr>
            <tr>
              <td style={{ ...cell, lineHeight: 1.5, paddingLeft: 16, height: 54 }} colSpan={6}>
                Charges to Appropriation/allotment necessary, lawful
                <br />
                and under my direct supervision
                <br />
                Supporting documents valid, proper and legal
              </td>
              <td style={{ ...cellCenter, verticalAlign: "middle" }} colSpan={6}>
                Existence of avaliable appropriation
              </td>
            </tr>

            <tr>
              <td style={labelCell} colSpan={2}>
                Signature
              </td>
              <td style={{ ...cell, height: 30 }} colSpan={4} />
              <td style={labelCell} colSpan={2}>
                Signature
              </td>
              <td style={{ ...cell, height: 30 }} colSpan={4} />
            </tr>
            <tr>
              <td style={labelCell} colSpan={2}>
                Printed
                <br />
                Name
              </td>
              <td style={{ ...cellCenter, fontWeight: 700, fontSize: 11 }} colSpan={4}>
                {doc.certifiedByName.toUpperCase()}
              </td>
              <td style={labelCell} colSpan={2}>
                Printed
                <br />
                Name
              </td>
              <td style={{ ...cellCenter, fontWeight: 700, fontSize: 11 }} colSpan={4}>
                {doc.budgetOfficerName.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style={labelCell} colSpan={2}>
                Position
              </td>
              <td style={cellCenter} colSpan={4}>
                <div style={{ fontWeight: 700, fontSize: 11 }}>{doc.certifiedByPosition}</div>
                <div style={{ fontSize: 9 }}>Head, Requesting Office/Authorized Representative</div>
              </td>
              <td style={labelCell} colSpan={2}>
                Position
              </td>
              <td style={cellCenter} colSpan={4}>
                <div style={{ fontWeight: 700, fontSize: 11 }}>{doc.budgetOfficerPosition}</div>
                <div style={{ fontSize: 9 }}>Head, Budget Unit/Authorized Representative</div>
              </td>
            </tr>
            <tr>
              <td style={labelCell} colSpan={2}>
                Date
              </td>
              <td style={{ ...cell, height: 26 }} colSpan={4} />
              <td style={labelCell} colSpan={2}>
                Date
              </td>
              <td style={{ ...cell, height: 26 }} colSpan={4} />
            </tr>
          </tbody>
        </table>
      </PaperSheet>
    </div>
  );
}
