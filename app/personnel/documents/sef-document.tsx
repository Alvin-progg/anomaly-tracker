"use client";

import { Fragment, useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { FieldInput } from "./field-input";
import {
  FillerRows,
  PaperSheet,
  amountOrBlank,
  amountOrDash,
  cell,
  cellHead,
  cellRight,
  longDate,
  parseAmount,
  parseRowCount,
} from "@/app/components/ui/paper";

/**
 * Special Education Fund — Continuing Appropriations.
 *
 * From `sample/Special Education Fund.jpg`. This is *not* a variant of the SAAO sheet, which is
 * why it has its own tab: only three money columns (there is no allotment stage for a continuing
 * project — the appropriation carried over already is the authority), the first column is headed
 * OBJECT OF EXPENDITURES rather than Function/Program/Project Activity, and it closes with
 * TOTAL CONTINUING PROJECTS.
 *
 * Every entry on the scan wraps across two or more printed lines — a numbered project line ending
 * in "@" and the school it applies to on the line beneath, with the figures on the school line.
 * That is a line break in the source document, not a nesting level, but it has to be modelled as
 * one because item 5 lists two schools under a single project number.
 *
 * Mixed casing in the column heads (APPROPRIATIONS / Obligations / BALANCE) is the form's own.
 */

interface SefDetail {
  label: string;
  appropriation: string;
  obligations: string;
}

interface SefItem {
  title: string;
  details: SefDetail[];
}

interface SefDoc {
  asOf: string;
  items: SefItem[];
  pad: string;
}

const BLANK_DETAIL: SefDetail = { label: "", appropriation: "", obligations: "" };
const BLANK_ITEM: SefItem = { title: "", details: [BLANK_DETAIL] };

const EMPTY_DOC: SefDoc = { asOf: "", items: [BLANK_ITEM], pad: "2" };

const COLS = 4;

function detailsIn(items: SefItem[]): SefDetail[] {
  return items.flatMap((item) => item.details);
}

function MoneyCells({ detail }: { detail: SefDetail }) {
  const appropriation = parseAmount(detail.appropriation);
  const obligations = parseAmount(detail.obligations);
  return (
    <>
      <td style={cellRight}>{amountOrBlank(appropriation)}</td>
      <td style={cellRight}>{amountOrDash(obligations)}</td>
      <td style={cellRight}>{amountOrDash(appropriation - obligations)}</td>
    </>
  );
}

export function SefDocument({ defaultAsOf = "" }: { defaultAsOf?: string }) {
  const [doc, setDoc] = useState<SefDoc>({ ...EMPTY_DOC, asOf: defaultAsOf });
  const set = <K extends keyof SefDoc>(key: K, value: SefDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));

  // Derive from `prev`, not the render-scope `doc` — two updates against the same render would
  // otherwise drop the first.
  const setItem = (i: number, patch: Partial<SefItem>) =>
    setDoc((prev) => ({ ...prev, items: prev.items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)) }));

  const setDetail = (i: number, d: number, key: keyof SefDetail, value: string) =>
    setDoc((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) =>
        idx === i
          ? { ...item, details: item.details.map((detail, j) => (j === d ? { ...detail, [key]: value } : detail)) }
          : item
      ),
    }));

  const removeItem = (i: number) => setDoc((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  const addItem = () => setDoc((prev) => ({ ...prev, items: [...prev.items, BLANK_ITEM] }));

  const totals = detailsIn(doc.items).reduce(
    (acc, detail) => ({
      appropriation: acc.appropriation + parseAmount(detail.appropriation),
      obligations: acc.obligations + parseAmount(detail.obligations),
    }),
    { appropriation: 0, obligations: 0 }
  );

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Document Details</SectionTitle>
          <FieldInput label="As of Date" type="date" value={doc.asOf} onChange={(v) => set("asOf", v)} />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Continuing Projects</SectionTitle>
          <div className="flex flex-col gap-3">
            {doc.items.map((item, i) => (
              <div key={i} className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#6B7A99]">Project {i + 1}</span>
                  {doc.items.length > 1 && (
                    <Btn variant="ghost" small onClick={() => removeItem(i)}>
                      Remove
                    </Btn>
                  )}
                </div>
                <FieldInput
                  label="Object of Expenditure"
                  value={item.title}
                  onChange={(v) => setItem(i, { title: v })}
                  placeholder="e.g. Improvement of School Facilities @"
                />

                {item.details.map((detail, d) => (
                  <div key={d} className="border-l-2 border-[#D1D9E6] pl-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-semibold text-[#9BA8BE]">Location {d + 1}</span>
                      {item.details.length > 1 && (
                        <Btn
                          variant="ghost"
                          small
                          onClick={() => setItem(i, { details: item.details.filter((_, idx) => idx !== d) })}
                        >
                          Remove
                        </Btn>
                      )}
                    </div>
                    <FieldInput
                      value={detail.label}
                      onChange={(v) => setDetail(i, d, "label", v)}
                      placeholder="e.g. San Pascual National High School"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <FieldInput
                        label="Appropriations"
                        value={detail.appropriation}
                        onChange={(v) => setDetail(i, d, "appropriation", v)}
                        placeholder="0.00"
                      />
                      <FieldInput
                        label="Obligations"
                        value={detail.obligations}
                        onChange={(v) => setDetail(i, d, "obligations", v)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}

                <Btn variant="ghost" small onClick={() => setItem(i, { details: [...item.details, BLANK_DETAIL] })}>
                  + Add Location
                </Btn>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-3">
            <Btn variant="ghost" small onClick={addItem}>
              + Add Project
            </Btn>
            <div className="w-28">
              <FieldInput label="Blank rows" value={doc.pad} onChange={(v) => set("pad", v)} placeholder="2" />
            </div>
          </div>
        </SectionCard>

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <PaperSheet>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>SPECIAL EDUCATION FUND</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Continuing Appropriations</div>
          <div style={{ fontSize: 11 }}>As of {longDate(doc.asOf)}</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ ...cellHead, width: "52%" }}>OBJECT OF EXPENDITURES</th>
              <th style={{ ...cellHead, width: "16%" }}>APPROPRIATIONS</th>
              <th style={{ ...cellHead, width: "16%" }}>Obligations</th>
              <th style={{ ...cellHead, width: "16%" }}>BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => (
              <Fragment key={i}>
                <tr>
                  <td style={cell}>
                    <span style={{ display: "inline-block", width: 16 }}>{i + 1}</span>
                    {item.title}
                  </td>
                  <td style={cell} />
                  <td style={cell} />
                  <td style={cell} />
                </tr>
                {item.details.map((detail, d) => (
                  <tr key={d}>
                    <td style={{ ...cell, paddingLeft: 22 }}>{detail.label}</td>
                    <MoneyCells detail={detail} />
                  </tr>
                ))}
              </Fragment>
            ))}
            <FillerRows count={parseRowCount(doc.pad, 2)} cols={COLS} />
            <tr style={{ fontWeight: 700 }}>
              <td style={{ ...cell, textAlign: "center", fontSize: 11 }}>TOTAL CONTINUING PROJECTS</td>
              <td style={cellRight}>{amountOrDash(totals.appropriation)}</td>
              <td style={cellRight}>{amountOrDash(totals.obligations)}</td>
              <td style={cellRight}>{amountOrDash(totals.appropriation - totals.obligations)}</td>
            </tr>
          </tbody>
        </table>
      </PaperSheet>
    </div>
  );
}
