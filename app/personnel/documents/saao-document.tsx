"use client";

import { Fragment, useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { FieldInput, FieldSelect } from "./field-input";
import {
  FillerRows,
  PaperSheet,
  amountOrBlank,
  amountOrDash,
  cell,
  cellCenter,
  cellHead,
  cellRight,
  longDate,
  parseAmount,
  parseRowCount,
} from "@/app/components/ui/paper";

/**
 * Status of Appropriation, Allotment and Obligations.
 *
 * Layout is taken from the scanned sheets in `sample/` — "SAAO- ELEMENTARY EDUCATION with data.png"
 * (filled), plus the Secondary Education and General Administration blanks. Three things about that
 * form that a summary table does not capture, and that this component exists to reproduce:
 *
 *  - The title is singular: STATUS OF APPROPRIATION, ALLOTMENT AND OBLIGATIONS.
 *  - `Balance` is one header spanning two sub-columns, `Allotment` and `Appropriations`. They are
 *    different subtractions (see `leafBalances`), not one number rendered twice.
 *  - Entries are two levels deep. A numbered activity ("1 Demolition of School Building") carries
 *    no figures of its own when it has facility rows beneath it ("-Pook ni Banal ES"); the money
 *    sits on the leaves. An activity with no children carries its own figures ("2 Other Supplies -
 *    ALS"). Totals therefore sum leaves, never both levels.
 *
 * The sheet has no Republic-of-the-Philippines letterhead and no signature block. It is a working
 * schedule, not a certified document — do not add either back.
 */

interface SaaoLeaf {
  label: string;
  appropriation: string;
  allotment: string;
  obligation: string;
}

interface SaaoItem extends SaaoLeaf {
  children: SaaoLeaf[];
}

interface SaaoDoc {
  asOf: string;
  office: string;
  appropriationType: "current" | "supplemental";
  mooe: SaaoItem[];
  mooePad: string;
  co: SaaoItem[];
  coPad: string;
}

const BLANK_LEAF: SaaoLeaf = { label: "", appropriation: "", allotment: "", obligation: "" };
const BLANK_ITEM: SaaoItem = { ...BLANK_LEAF, children: [] };

const EMPTY_DOC: SaaoDoc = {
  asOf: "",
  office: "",
  appropriationType: "current",
  mooe: [BLANK_ITEM],
  mooePad: "1",
  co: [],
  coPad: "4",
};

/** "Continuing Appropriations" is a different form entirely — see sef-document.tsx. */
const TYPE_OPTIONS = [
  { value: "current", label: "Current Legislative Appropriation" },
  { value: "supplemental", label: "Supplemental Budget" },
];

const TYPE_LABEL: Record<SaaoDoc["appropriationType"], string> = {
  current: "Current Legislative Appropriation",
  supplemental: "Supplemental Budget",
};

const COLS = 6;

/** The rows that actually carry money: an item's children, or the item itself if it has none. */
function leavesOf(item: SaaoItem): SaaoLeaf[] {
  return item.children.length > 0 ? item.children : [item];
}

function leavesIn(items: SaaoItem[]): SaaoLeaf[] {
  return items.flatMap(leavesOf);
}

interface Money {
  appropriation: number;
  allotment: number;
  obligation: number;
}

function sumLeaves(leaves: SaaoLeaf[]): Money {
  return leaves.reduce(
    (acc, leaf) => ({
      appropriation: acc.appropriation + parseAmount(leaf.appropriation),
      allotment: acc.allotment + parseAmount(leaf.allotment),
      obligation: acc.obligation + parseAmount(leaf.obligation),
    }),
    { appropriation: 0, allotment: 0, obligation: 0 }
  );
}

/**
 * The two Balance columns are different subtractions. On the Elementary sheet, San Antonio ES shows
 * Allotment 2,600,000.00 − Obligation 2,596,555.99 = 3,444.01 under Balance/Allotment, and
 * Appropriations 2,600,000.00 − Allotment 2,600,000.00 = 0, printed as "-", under
 * Balance/Appropriations.
 */
function leafBalances(money: Money): { allotment: number; appropriation: number } {
  return {
    allotment: money.allotment - money.obligation,
    appropriation: money.appropriation - money.allotment,
  };
}

function MoneyCells({ money }: { money: Money }) {
  const balance = leafBalances(money);
  return (
    <>
      <td style={cellRight}>{amountOrBlank(money.appropriation)}</td>
      <td style={cellRight}>{amountOrBlank(money.allotment)}</td>
      <td style={cellRight}>{amountOrBlank(money.obligation)}</td>
      <td style={cellRight}>{amountOrDash(balance.allotment)}</td>
      <td style={cellRight}>{amountOrDash(balance.appropriation)}</td>
    </>
  );
}

function TotalRow({ label, leaves, heavy }: { label: string; leaves: SaaoLeaf[]; heavy?: boolean }) {
  const money = sumLeaves(leaves);
  const balance = leafBalances(money);
  return (
    <tr style={{ fontWeight: 700 }}>
      <td style={{ ...cellCenter, fontSize: heavy ? 11 : 10 }}>{label}</td>
      <td style={cellRight}>{amountOrDash(money.appropriation)}</td>
      <td style={cellRight}>{amountOrDash(money.allotment)}</td>
      <td style={cellRight}>{amountOrDash(money.obligation)}</td>
      <td style={cellRight}>{amountOrDash(balance.allotment)}</td>
      <td style={cellRight}>{amountOrDash(balance.appropriation)}</td>
    </tr>
  );
}

function SectionRows({ heading, items }: { heading: string; items: SaaoItem[] }) {
  return (
    <>
      <tr>
        <td style={{ ...cell, fontWeight: 700 }}>{heading}</td>
        <td style={cell} />
        <td style={cell} />
        <td style={cell} />
        <td style={cell} />
        <td style={cell} />
      </tr>
      {items.map((item, i) => {
        const hasChildren = item.children.length > 0;
        return (
          <Fragment key={i}>
            <tr>
              <td style={cell}>
                <span style={{ display: "inline-block", width: 16 }}>{i + 1}</span>
                {item.label}
              </td>
              {hasChildren ? (
                <>
                  <td style={cell} />
                  <td style={cell} />
                  <td style={cell} />
                  <td style={cell} />
                  <td style={cell} />
                </>
              ) : (
                <MoneyCells
                  money={{
                    appropriation: parseAmount(item.appropriation),
                    allotment: parseAmount(item.allotment),
                    obligation: parseAmount(item.obligation),
                  }}
                />
              )}
            </tr>
            {item.children.map((child, c) => (
              <tr key={c}>
                <td style={{ ...cell, paddingLeft: 30 }}>{child.label}</td>
                <MoneyCells
                  money={{
                    appropriation: parseAmount(child.appropriation),
                    allotment: parseAmount(child.allotment),
                    obligation: parseAmount(child.obligation),
                  }}
                />
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

function LeafFields({
  leaf,
  onChange,
}: {
  leaf: SaaoLeaf;
  onChange: (key: keyof SaaoLeaf, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <FieldInput label="Appropriations" value={leaf.appropriation} onChange={(v) => onChange("appropriation", v)} placeholder="0.00" />
      <FieldInput label="Allotment" value={leaf.allotment} onChange={(v) => onChange("allotment", v)} placeholder="0.00" />
      <FieldInput label="Obligation" value={leaf.obligation} onChange={(v) => onChange("obligation", v)} placeholder="0.00" />
    </div>
  );
}

function ItemEditor({
  title,
  items,
  onChange,
  pad,
  onPadChange,
  activityPlaceholder,
  childPlaceholder,
}: {
  title: string;
  items: SaaoItem[];
  onChange: (items: SaaoItem[]) => void;
  pad: string;
  onPadChange: (value: string) => void;
  activityPlaceholder: string;
  childPlaceholder: string;
}) {
  const setItem = (i: number, patch: Partial<SaaoItem>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  const setChild = (i: number, c: number, key: keyof SaaoLeaf, value: string) =>
    setItem(i, { children: items[i].children.map((child, idx) => (idx === c ? { ...child, [key]: value } : child)) });

  return (
    <SectionCard>
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#6B7A99]">Activity {i + 1}</span>
              <Btn variant="ghost" small onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                Remove
              </Btn>
            </div>
            <FieldInput
              label="Function / Program / Project Activity"
              value={item.label}
              onChange={(v) => setItem(i, { label: v })}
              placeholder={activityPlaceholder}
            />

            {item.children.length === 0 && <LeafFields leaf={item} onChange={(key, value) => setItem(i, { [key]: value })} />}

            {item.children.map((child, c) => (
              <div key={c} className="border-l-2 border-[#D1D9E6] pl-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-[#9BA8BE]">Sub-item {c + 1}</span>
                  <Btn
                    variant="ghost"
                    small
                    onClick={() => setItem(i, { children: item.children.filter((_, idx) => idx !== c) })}
                  >
                    Remove
                  </Btn>
                </div>
                <FieldInput
                  value={child.label}
                  onChange={(v) => setChild(i, c, "label", v)}
                  placeholder={childPlaceholder}
                />
                <LeafFields leaf={child} onChange={(key, value) => setChild(i, c, key, value)} />
              </div>
            ))}

            <Btn variant="ghost" small onClick={() => setItem(i, { children: [...item.children, BLANK_LEAF] })}>
              + Add Sub-item
            </Btn>
            {item.children.length === 0 && (
              <p className="text-[11px] text-[#9BA8BE]">
                Add sub-items to list facilities beneath this activity; its own amounts are then left blank, as on the form.
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <Btn variant="ghost" small onClick={() => onChange([...items, BLANK_ITEM])}>
          + Add Activity
        </Btn>
        <div className="w-28">
          <FieldInput label="Blank rows" value={pad} onChange={onPadChange} placeholder="1" />
        </div>
      </div>
    </SectionCard>
  );
}

export function SaaoDocument({ defaultAsOf = "" }: { defaultAsOf?: string }) {
  const [doc, setDoc] = useState<SaaoDoc>({ ...EMPTY_DOC, asOf: defaultAsOf });
  const set = <K extends keyof SaaoDoc>(key: K, value: SaaoDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));

  const mooeLeaves = leavesIn(doc.mooe);
  const coLeaves = leavesIn(doc.co);
  const hasCapitalOutlay = doc.co.length > 0;

  /**
   * The Elementary and Secondary sheets close with "Subtotal" because each is one office in a
   * multi-office set. General Administration, which has no Capital Outlay section, closes with
   * "GRANDTOTAL" instead.
   */
  const closingLabel = hasCapitalOutlay ? "Subtotal" : "GRANDTOTAL";

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldInput label="As of Date" type="date" value={doc.asOf} onChange={(v) => set("asOf", v)} />
            <FieldSelect
              label="Appropriation Type"
              value={doc.appropriationType}
              onChange={(v) => set("appropriationType", v as SaaoDoc["appropriationType"])}
              options={TYPE_OPTIONS}
            />
            <FieldInput
              label="Office / Department"
              value={doc.office}
              onChange={(v) => set("office", v)}
              placeholder="e.g. Elementary Education"
            />
          </div>
        </SectionCard>

        <ItemEditor
          title="Maintenance & Other Operating Expenses"
          items={doc.mooe}
          onChange={(items) => set("mooe", items)}
          pad={doc.mooePad}
          onPadChange={(v) => set("mooePad", v)}
          activityPlaceholder="e.g. Demolition of School Building"
          childPlaceholder="e.g. -Pook ni Banal ES"
        />

        <ItemEditor
          title="Capital Outlay"
          items={doc.co}
          onChange={(items) => set("co", items)}
          pad={doc.coPad}
          onPadChange={(v) => set("coPad", v)}
          activityPlaceholder="e.g. Improvement of School Facilities"
          childPlaceholder="e.g. -San Antonio ES"
        />

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <PaperSheet>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>STATUS OF APPROPRIATION, ALLOTMENT AND OBLIGATIONS</div>
          <div style={{ fontSize: 11 }}>({TYPE_LABEL[doc.appropriationType]})</div>
          <div style={{ fontSize: 11 }}>As of {longDate(doc.asOf)}</div>
        </div>

        <div style={{ marginBottom: 8, fontSize: 11, paddingLeft: 24 }}>
          Office/Department&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;
          <strong>{doc.office ? doc.office.toUpperCase() : "________________"}</strong>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ ...cellHead, width: "34%" }} rowSpan={2}>
                Function/Program/Project Activity
              </th>
              <th style={{ ...cellHead, width: "13%" }} rowSpan={2}>
                APPROPRIATIONS
              </th>
              <th style={{ ...cellHead, width: "13%" }} rowSpan={2}>
                ALLOTMENT
              </th>
              <th style={{ ...cellHead, width: "13%" }} rowSpan={2}>
                OBLIGATION
              </th>
              <th style={cellHead} colSpan={2}>
                Balance
              </th>
            </tr>
            <tr>
              <th style={{ ...cellHead, width: "13%" }}>Allotment</th>
              <th style={{ ...cellHead, width: "14%" }}>Appropriations</th>
            </tr>
          </thead>
          <tbody>
            <SectionRows heading="Maintenance & Other Operating Expenses" items={doc.mooe} />
            <FillerRows count={parseRowCount(doc.mooePad, 1)} cols={COLS} />
            <TotalRow label="TOTAL MOOE" leaves={mooeLeaves} />

            {hasCapitalOutlay && (
              <>
                <SectionRows heading="Capital Outlay" items={doc.co} />
                <FillerRows count={parseRowCount(doc.coPad, 4)} cols={COLS} />
                <TotalRow label="TOTAL CAPITAL OUTLAY" leaves={coLeaves} />
              </>
            )}

            <TotalRow label={closingLabel} leaves={[...mooeLeaves, ...coLeaves]} heavy />
          </tbody>
        </table>
      </PaperSheet>
    </div>
  );
}
