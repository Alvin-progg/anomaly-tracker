"use client";

import { Fragment, useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { FieldInput } from "./field-input";
import {
  FillerRows,
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
 * Approved Budget for the Contract.
 *
 * From `sample/Approved Budget For the contract.png`. Landscape — the form is twelve leaf columns
 * wide under a two-row grouped header and clips at the right edge on a portrait sheet, which is
 * why PaperSheet is given orientation="landscape" (see the named @page rule in globals.css).
 *
 * Most of those columns print blank on a supplies purchase: the market-price, VAT, freight,
 * indirect-cost and adjustment columns exist for works and consultancy contracts where the ABC is
 * built up from cost factors. They are still rendered and still editable — a form that silently
 * drops columns the procurement officer needs is worse than one with empty cells, and the empty
 * cells are what the filed copy looks like.
 *
 * Items are grouped by expense class ("Other Supplies Expense" on the sample), each group closing
 * with TOTAL and the sheet closing with GRANDTOTAL. The sample's GRANDTOTAL (16,033.55) exceeds
 * its single visible TOTAL (6,025.00) because the filed document runs to further groups — hence
 * groups being a list rather than one fixed section.
 */

interface AbcItem {
  description: string;
  qty: string;
  unit: string;
  marketPrice: string;
  vat: string;
  freight: string;
  indirect: string;
  adjustmentPct: string;
  adjustmentValue: string;
  unitCost: string;
}

interface AbcGroup {
  label: string;
  items: AbcItem[];
}

interface AbcDoc {
  station: string;
  length: string;
  subject: string;
  groups: AbcGroup[];
  preparedBy: string;
  preparedByPosition: string;
  reviewedBy: string;
  reviewedByPosition: string;
  approvedBy: string;
  approvedByPosition: string;
}

const BLANK_ITEM: AbcItem = {
  description: "",
  qty: "",
  unit: "",
  marketPrice: "",
  vat: "",
  freight: "",
  indirect: "",
  adjustmentPct: "",
  adjustmentValue: "",
  unitCost: "",
};

const BLANK_GROUP: AbcGroup = { label: "", items: [BLANK_ITEM] };

const EMPTY_DOC: AbcDoc = {
  station: "",
  length: "",
  subject: "",
  groups: [BLANK_GROUP],
  preparedBy: SIGNATORIES.preparer.name,
  preparedByPosition: SIGNATORIES.preparer.position,
  reviewedBy: SIGNATORIES.budgetOfficer.name,
  reviewedByPosition: SIGNATORIES.budgetOfficer.position,
  approvedBy: SIGNATORIES.mayor.name,
  approvedByPosition: SIGNATORIES.mayor.position,
};

const COLS = 12;
const MIN_BODY_ROWS = 10;

const COL_WIDTHS = ["5%", "19%", "5%", "6%", "9%", "10%", "8%", "8%", "5%", "7%", "8%", "10%"];

/** 5 packs at 400.00 is 2,000.00 on the sample sheet — quantity times unit cost, nothing else. */
function lineTotal(item: AbcItem): number {
  return parseAmount(item.qty) * parseAmount(item.unitCost);
}

function groupTotal(group: AbcGroup): number {
  return group.items.reduce((sum, item) => sum + lineTotal(item), 0);
}

function ItemRow({ item, index }: { item: AbcItem; index: number }) {
  const total = lineTotal(item);
  return (
    <tr>
      <td style={cellCenter}>{item.description ? index : ""}</td>
      <td style={cell}>{item.description}</td>
      <td style={cellCenter}>{item.qty}</td>
      <td style={cellCenter}>{item.unit}</td>
      <td style={cellRight}>{amountOrBlank(item.marketPrice)}</td>
      <td style={cellRight}>{amountOrBlank(item.vat)}</td>
      <td style={cellRight}>{amountOrBlank(item.freight)}</td>
      <td style={cellRight}>{amountOrBlank(item.indirect)}</td>
      <td style={cellCenter}>{item.adjustmentPct}</td>
      <td style={cellRight}>{amountOrBlank(item.adjustmentValue)}</td>
      <td style={cellRight}>{amountOrBlank(item.unitCost)}</td>
      <td style={cellRight}>{total === 0 ? "" : amountOrDash(total)}</td>
    </tr>
  );
}

export function AbcDocument() {
  const [doc, setDoc] = useState<AbcDoc>(EMPTY_DOC);

  const set = <K extends keyof AbcDoc>(key: K, value: AbcDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));

  const setGroup = (g: number, patch: Partial<AbcGroup>) =>
    set("groups", doc.groups.map((group, idx) => (idx === g ? { ...group, ...patch } : group)));

  const setItem = (g: number, i: number, key: keyof AbcItem, value: string) =>
    setGroup(g, { items: doc.groups[g].items.map((item, idx) => (idx === i ? { ...item, [key]: value } : item)) });

  const grandTotal = doc.groups.reduce((sum, group) => sum + groupTotal(group), 0);
  const bodyRowCount = doc.groups.reduce((sum, group) => sum + group.items.length + 2, 0);

  const signatories = [
    { label: "Prepared / Submitted by:", name: doc.preparedBy, position: doc.preparedByPosition },
    { label: "Reviewed as to Appropriation:", name: doc.reviewedBy, position: doc.reviewedByPosition },
    { label: "Approved by:", name: doc.approvedBy, position: doc.approvedByPosition },
  ];

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput
              label="Subject (printed under the title)"
              value={doc.subject}
              onChange={(v) => set("subject", v)}
              placeholder="e.g. Office Supplies Expense/Other Supplies Expense"
            />
            <div className="grid grid-cols-2 gap-2">
              <FieldInput label="Station" value={doc.station} onChange={(v) => set("station", v)} placeholder="e.g. MBO" />
              <FieldInput label="Length" value={doc.length} onChange={(v) => set("length", v)} />
            </div>
          </div>
        </SectionCard>

        {doc.groups.map((group, g) => (
          <SectionCard key={g}>
            <div className="flex justify-between items-center mb-3.5">
              <SectionTitle>Group {g + 1}</SectionTitle>
              {doc.groups.length > 1 && (
                <Btn variant="ghost" small onClick={() => set("groups", doc.groups.filter((_, idx) => idx !== g))}>
                  Remove Group
                </Btn>
              )}
            </div>
            <FieldInput
              label="Expense Class"
              value={group.label}
              onChange={(v) => setGroup(g, { label: v })}
              placeholder="e.g. Other Supplies Expense"
            />
            <div className="flex flex-col gap-3 mt-3">
              {group.items.map((item, i) => (
                <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#6B7A99]">Item {i + 1}</span>
                    {group.items.length > 1 && (
                      <Btn
                        variant="ghost"
                        small
                        onClick={() => setGroup(g, { items: group.items.filter((_, idx) => idx !== i) })}
                      >
                        Remove
                      </Btn>
                    )}
                  </div>
                  <FieldInput
                    label="Description"
                    value={item.description}
                    onChange={(v) => setItem(g, i, "description", v)}
                    placeholder="e.g. Trash bag large"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <FieldInput label="Qty." value={item.qty} onChange={(v) => setItem(g, i, "qty", v)} placeholder="5" />
                    <FieldInput label="Unit" value={item.unit} onChange={(v) => setItem(g, i, "unit", v)} placeholder="packs" />
                    <FieldInput
                      label="Unit Cost"
                      value={item.unitCost}
                      onChange={(v) => setItem(g, i, "unitCost", v)}
                      placeholder="400.00"
                    />
                  </div>
                  <details>
                    <summary className="text-[11px] font-semibold text-[#6B7A99] cursor-pointer">
                      Cost factors (usually blank for supplies)
                    </summary>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <FieldInput
                        label="Current Market Price"
                        value={item.marketPrice}
                        onChange={(v) => setItem(g, i, "marketPrice", v)}
                      />
                      <FieldInput label="VAT / Duties" value={item.vat} onChange={(v) => setItem(g, i, "vat", v)} />
                      <FieldInput label="Freight & Insurance" value={item.freight} onChange={(v) => setItem(g, i, "freight", v)} />
                      <FieldInput label="Other Indirect Cost" value={item.indirect} onChange={(v) => setItem(g, i, "indirect", v)} />
                      <FieldInput
                        label="Adjustment %"
                        value={item.adjustmentPct}
                        onChange={(v) => setItem(g, i, "adjustmentPct", v)}
                      />
                      <FieldInput
                        label="Adjustment Value"
                        value={item.adjustmentValue}
                        onChange={(v) => setItem(g, i, "adjustmentValue", v)}
                      />
                    </div>
                  </details>
                </div>
              ))}
            </div>
            <Btn variant="ghost" small onClick={() => setGroup(g, { items: [...group.items, BLANK_ITEM] })} className="mt-3">
              + Add Item
            </Btn>
          </SectionCard>
        ))}

        <Btn variant="ghost" small onClick={() => set("groups", [...doc.groups, BLANK_GROUP])}>
          + Add Expense Group
        </Btn>

        <SectionCard>
          <SectionTitle>Signatories</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="Prepared / Submitted by" value={doc.preparedBy} onChange={(v) => set("preparedBy", v)} />
            <FieldInput label="Position" value={doc.preparedByPosition} onChange={(v) => set("preparedByPosition", v)} />
            <FieldInput label="Reviewed as to Appropriation" value={doc.reviewedBy} onChange={(v) => set("reviewedBy", v)} />
            <FieldInput label="Position" value={doc.reviewedByPosition} onChange={(v) => set("reviewedByPosition", v)} />
            <FieldInput label="Approved by" value={doc.approvedBy} onChange={(v) => set("approvedBy", v)} />
            <FieldInput label="Position" value={doc.approvedByPosition} onChange={(v) => set("approvedByPosition", v)} />
          </div>
        </SectionCard>

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <PaperSheet orientation="landscape">
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.04em" }}>APPROVED BUDGET FOR THE CONTRACT</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{doc.subject}</div>
        </div>

        <div style={{ marginBottom: 8, fontSize: 10 }}>
          <div>
            Station:&nbsp;
            <span style={{ display: "inline-block", minWidth: 200, borderBottom: "1px solid #000", textAlign: "center" }}>
              {doc.station}
            </span>
          </div>
          <div>
            Length:&nbsp;
            <span style={{ display: "inline-block", minWidth: 200, borderBottom: "1px solid #000", textAlign: "center" }}>
              {doc.length}
            </span>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
          <colgroup>
            {COL_WIDTHS.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={cellHead} rowSpan={2}>
                Item No.
              </th>
              <th style={cellHead} rowSpan={2}>
                Description
              </th>
              <th style={cellHead} rowSpan={2}>
                Qty.
              </th>
              <th style={cellHead} rowSpan={2}>
                Unit
              </th>
              <th style={cellHead} rowSpan={2}>
                Current Market Price (Php)
              </th>
              <th style={cellHead} rowSpan={2}>
                VAT, Other Taxes and/or Duties Applicable
              </th>
              <th style={cellHead} rowSpan={2}>
                Freight &amp; Insurance
              </th>
              <th style={cellHead} rowSpan={2}>
                Other Indirect Cost
              </th>
              <th style={cellHead} colSpan={2}>
                Other Cost Factors, Inflation, Currency Validation Adjustment
              </th>
              <th style={cellHead} colSpan={2}>
                Contract/Duration
              </th>
            </tr>
            <tr>
              <th style={cellHead}>%</th>
              <th style={cellHead}>Value</th>
              <th style={cellHead}>Unit Cost</th>
              <th style={cellHead}>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {doc.groups.map((group, g) => (
              <Fragment key={g}>
                <tr>
                  <td style={cell} />
                  <td style={{ ...cell, fontWeight: 700 }}>{group.label}</td>
                  {Array.from({ length: COLS - 2 }).map((_, c) => (
                    <td key={c} style={cell} />
                  ))}
                </tr>
                {group.items.map((item, i) => (
                  <ItemRow key={i} item={item} index={i + 1} />
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td style={cell} />
                  <td style={cell}>TOTAL</td>
                  {Array.from({ length: COLS - 3 }).map((_, c) => (
                    <td key={c} style={cell} />
                  ))}
                  <td style={cellRight}>{amountOrDash(groupTotal(group))}</td>
                </tr>
              </Fragment>
            ))}

            <FillerRows count={Math.max(0, MIN_BODY_ROWS - bodyRowCount)} cols={COLS} />

            <tr style={{ fontWeight: 700, fontStyle: "italic" }}>
              <td style={cell} />
              <td style={cell}>GRANDTOTAL</td>
              {Array.from({ length: COLS - 3 }).map((_, c) => (
                <td key={c} style={cell} />
              ))}
              <td style={cellRight}>{amountOrDash(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, fontSize: 10 }}>
          {signatories.map((s) => (
            <div key={s.label}>
              <div style={{ marginBottom: 34 }}>{s.label}</div>
              <div style={{ textAlign: "center", fontWeight: 700, fontSize: 11 }}>{s.name.toUpperCase()}</div>
              <div style={{ textAlign: "center", fontStyle: "italic" }}>{s.position}</div>
            </div>
          ))}
        </div>
      </PaperSheet>
    </div>
  );
}
