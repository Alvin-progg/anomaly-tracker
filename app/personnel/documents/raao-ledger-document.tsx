"use client";

import { useState } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Btn } from "@/app/components/ui/btn";
import { FieldInput, FieldSelect } from "./field-input";
import {
  BAND_COLOR,
  FillerRows,
  PaperSheet,
  amountOrBlank,
  amountOrDash,
  cell,
  cellCenter,
  cellHead,
  cellRight,
  parseAmount,
  shortDate,
} from "@/app/components/ui/paper";

/**
 * Registry of Appropriations, Allotments and Obligations — Personal Services.
 *
 * From `sample/RAAO.png`. This is the widest and least table-like of the five forms, and the two
 * things that make it so are both load-bearing:
 *
 *  1. The header is four rows deep. Seventeen object-of-expenditure columns sit under "Obligations
 *     Incurred", each labelled with a name *and* its COA account code, and five of them are
 *     themselves nested under "other personnel benefits" (all five sharing code 5-01-04-990).
 *     See ACCOUNTS below — the columns and their codes are the registry's whole point.
 *  2. The body is a sequence of *bands*, not a flat list of transactions. Budget and allotment
 *     releases open a block, dated obligations accumulate under it, and three running totals close
 *     it. The office reads the page by the colour of those bands — red for expenses, blue for
 *     balances, green for supplemental — so the colours are data, not decoration, and globals.css
 *     forces `print-color-adjust: exact` to stop the printer discarding them.
 *
 * The three total bands are computed rather than typed: TOTAL EXPENSES THIS DATE sums the entries
 * since the previous one, TOTAL EXPENSES TO DATE is cumulative from the top of the page, and TOTAL
 * ALLOTMENT BALANCES is everything released so far less everything obligated so far. Keying those
 * by hand across seventeen columns is exactly where a ledger goes wrong.
 *
 * The TOTALS column is likewise computed as the sum of the seventeen account columns — verified
 * against the sample's annual-budget line, whose account columns sum to its printed 3,296,825.14.
 *
 * Landscape. There is no signature block on this form.
 */

interface Account {
  key: string;
  name: string;
  code: string;
}

/** The eight standalone accounts, then the five nested under "other personnel benefits", then the
 *  four premium/contribution accounts. Order is the printed column order — do not re-sort. */
const ACCOUNTS_LEAD: Account[] = [
  { key: "salaries", name: "Salaries", code: "5-01-01-010" },
  { key: "pera", name: "PERA", code: "5-01-02-010" },
  { key: "repAllow", name: "rep. allow", code: "5-01-02-020" },
  { key: "transAllow", name: "trans. Allow,", code: "5-01-02-030" },
  { key: "clothing", name: "clothing", code: "5-01-02-040" },
  { key: "midYearBonus", name: "mid year bonus", code: "5-01-02-990" },
  { key: "yearEndBonus", name: "year end bonus", code: "5-02-02-140" },
  { key: "cashGift", name: "cash gift", code: "5-01-02-150" },
];

const ACCOUNTS_OTHER_BENEFITS: Account[] = [
  { key: "pei", name: "PEI", code: "5-01-04-990" },
  { key: "monetization", name: "Monetization", code: "5-01-04-990" },
  { key: "sri", name: "SRI", code: "5-01-04-990" },
  { key: "cnai", name: "CNAI", code: "5-01-04-990" },
  { key: "medicalAllowance", name: "medical allowance", code: "5-01-04-990" },
];

const ACCOUNTS_TRAIL: Account[] = [
  { key: "lifeRet", name: "life & ret.", code: "5-01-03-010" },
  { key: "pagIbig", name: "pag-ibig", code: "5-01-03-020" },
  { key: "philHealth", name: "philhealth", code: "5-01-03-030" },
  { key: "stateIns", name: "state ins.", code: "5-01-03-040" },
];

const ACCOUNTS: Account[] = [...ACCOUNTS_LEAD, ...ACCOUNTS_OTHER_BENEFITS, ...ACCOUNTS_TRAIL];

/** Date, AO/AA, Appropriation, Allotment, Bal of Appropriation, TOTALS, then the accounts. */
const COLS = 6 + ACCOUNTS.length;

type Amounts = Record<string, string>;
type Totals = Record<string, number>;

const ZERO: Totals = Object.fromEntries(ACCOUNTS.map((a) => [a.key, 0]));

function sumAmounts(a: Totals, b: Totals): Totals {
  return Object.fromEntries(ACCOUNTS.map((acc) => [acc.key, (a[acc.key] ?? 0) + (b[acc.key] ?? 0)]));
}

function diffAmounts(a: Totals, b: Totals): Totals {
  return Object.fromEntries(ACCOUNTS.map((acc) => [acc.key, (a[acc.key] ?? 0) - (b[acc.key] ?? 0)]));
}

function toTotals(amounts: Amounts): Totals {
  return Object.fromEntries(ACCOUNTS.map((acc) => [acc.key, parseAmount(amounts[acc.key])]));
}

function rowTotal(totals: Totals): number {
  return ACCOUNTS.reduce((sum, acc) => sum + (totals[acc.key] ?? 0), 0);
}

type BandKind = "budget" | "released" | "supplemental" | "entry" | "expensesThisDate" | "expensesToDate" | "allotmentBalances";

interface Band {
  kind: BandKind;
  label: string;
  date: string;
  reference: string;
  allotment: string;
  amounts: Amounts;
}

/** Bands the user types figures into; the rest are derived from these. */
const CREDIT_KINDS: BandKind[] = ["budget", "released", "supplemental"];
const EDITABLE_KINDS: BandKind[] = [...CREDIT_KINDS, "entry"];

const BAND_META: Record<BandKind, { label: string; color: string; bold: boolean }> = {
  budget: { label: "Annual Budget", color: BAND_COLOR.budget, bold: true },
  released: { label: "Allotment Released", color: BAND_COLOR.budget, bold: true },
  supplemental: { label: "Supplemental Budget", color: BAND_COLOR.supplemental, bold: true },
  entry: { label: "Obligation Entry", color: BAND_COLOR.entry, bold: false },
  expensesThisDate: { label: "TOTAL EXPENSES THIS DATE", color: BAND_COLOR.expense, bold: true },
  expensesToDate: { label: "TOTAL EXPENSES TO DATE", color: BAND_COLOR.expense, bold: true },
  allotmentBalances: { label: "TOTAL ALLOTMENT BALANCES", color: BAND_COLOR.balance, bold: true },
};

function blankBand(kind: BandKind, label = ""): Band {
  return { kind, label, date: "", reference: "", allotment: "", amounts: {} };
}

interface LedgerDoc {
  fund: string;
  fiscalYear: string;
  fppCode: string;
  bands: Band[];
  pad: string;
}

const FUND_OPTIONS = [
  { value: "General Fund", label: "General Fund (GF)" },
  { value: "Special Education Fund", label: "Special Education Fund (SEF)" },
  { value: "20% Development Fund", label: "20% Development Fund" },
];

const EMPTY_DOC: LedgerDoc = {
  fund: "General Fund",
  fiscalYear: "",
  fppCode: "",
  bands: [blankBand("budget", "ANNUAL BUDGET CY")],
  pad: "3",
};

/**
 * Walk the bands in printed order, resolving each computed band from the ones above it. Returns
 * one resolved row per band so the table body is a straight map.
 */
function resolveBands(bands: Band[]): { band: Band; totals: Totals }[] {
  let credited = ZERO;
  let toDate = ZERO;
  let sinceLastThisDate = ZERO;

  return bands.map((band) => {
    if (CREDIT_KINDS.includes(band.kind)) {
      const totals = toTotals(band.amounts);
      credited = sumAmounts(credited, totals);
      return { band, totals };
    }
    if (band.kind === "entry") {
      const totals = toTotals(band.amounts);
      toDate = sumAmounts(toDate, totals);
      sinceLastThisDate = sumAmounts(sinceLastThisDate, totals);
      return { band, totals };
    }
    if (band.kind === "expensesThisDate") {
      const totals = sinceLastThisDate;
      sinceLastThisDate = ZERO;
      return { band, totals };
    }
    if (band.kind === "expensesToDate") {
      return { band, totals: toDate };
    }
    return { band, totals: diffAmounts(credited, toDate) };
  });
}

const rotated: React.CSSProperties = {
  ...cellHead,
  writingMode: "vertical-rl",
  transform: "rotate(180deg)",
  whiteSpace: "nowrap",
  padding: "4px 1px",
};

function BandRow({ band, totals }: { band: Band; totals: Totals }) {
  const meta = BAND_META[band.kind];
  const isEntry = band.kind === "entry";
  const isComputed = !EDITABLE_KINDS.includes(band.kind);
  const style: React.CSSProperties = { color: meta.color, fontWeight: meta.bold ? 700 : 400 };

  /** Computed bands print "-" in an empty column; typed bands leave it blank, as on the form. */
  const show = (value: number) => (isComputed ? amountOrDash(value) : amountOrBlank(value));

  /** A running-total band has no editable label — its caption is fixed by the form. */
  const caption = isComputed ? meta.label : band.label;

  return (
    <tr style={style}>
      {isEntry ? (
        <>
          <td style={cellCenter}>{shortDate(band.date)}</td>
          <td style={cellCenter}>{band.reference}</td>
        </>
      ) : (
        <td style={{ ...cellCenter, ...style }} colSpan={2}>
          {caption}
        </td>
      )}
      <td style={cell} />
      <td style={cellRight}>{amountOrBlank(band.allotment)}</td>
      <td style={cell} />
      <td style={cellRight}>{show(rowTotal(totals))}</td>
      {ACCOUNTS.map((account) => (
        <td key={account.key} style={cellRight}>
          {show(totals[account.key] ?? 0)}
        </td>
      ))}
    </tr>
  );
}

function BandEditor({
  band,
  index,
  onChange,
  onRemove,
  onMove,
}: {
  band: Band;
  index: number;
  onChange: (patch: Partial<Band>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const meta = BAND_META[band.kind];
  const editable = EDITABLE_KINDS.includes(band.kind);

  return (
    <div className="border border-[#D1D9E6] rounded-md p-3 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold" style={{ color: meta.color }}>
          {index + 1}. {meta.label}
        </span>
        <div className="flex gap-1">
          <Btn variant="ghost" small onClick={() => onMove(-1)}>
            ↑
          </Btn>
          <Btn variant="ghost" small onClick={() => onMove(1)}>
            ↓
          </Btn>
          <Btn variant="ghost" small onClick={onRemove}>
            Remove
          </Btn>
        </div>
      </div>

      {band.kind === "entry" ? (
        <div className="grid grid-cols-2 gap-2">
          <FieldInput label="Date" type="date" value={band.date} onChange={(v) => onChange({ date: v })} />
          <FieldInput
            label="Reference (AO/AA)"
            value={band.reference}
            onChange={(v) => onChange({ reference: v })}
            placeholder="100-25-01-0016"
          />
        </div>
      ) : editable ? (
        <FieldInput
          label="Row Label"
          value={band.label}
          onChange={(v) => onChange({ label: v })}
          placeholder={band.kind === "released" ? "ALLOTMENT RELEASED 1st qtr" : "ANNUAL BUDGET CY 2025"}
        />
      ) : (
        <p className="text-[11px] text-[#9BA8BE]">
          Computed from the rows above — no figures to enter.
        </p>
      )}

      {editable && (
        <>
          <FieldInput label="Allotment" value={band.allotment} onChange={(v) => onChange({ allotment: v })} placeholder="0.00" />
          <details>
            <summary className="text-[11px] font-semibold text-[#6B7A99] cursor-pointer">
              Obligations incurred — {ACCOUNTS.length} accounts
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ACCOUNTS.map((account) => (
                <FieldInput
                  key={account.key}
                  label={`${account.name} · ${account.code}`}
                  value={band.amounts[account.key] ?? ""}
                  onChange={(v) => onChange({ amounts: { ...band.amounts, [account.key]: v } })}
                  placeholder="0.00"
                />
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

export function RaaoLedgerDocument() {
  const [doc, setDoc] = useState<LedgerDoc>(EMPTY_DOC);
  const set = <K extends keyof LedgerDoc>(key: K, value: LedgerDoc[K]) => setDoc((prev) => ({ ...prev, [key]: value }));

  const addBand = (kind: BandKind) => set("bands", [...doc.bands, blankBand(kind)]);

  const moveBand = (i: number, delta: number) => {
    const target = i + delta;
    if (target < 0 || target >= doc.bands.length) return;
    const next = [...doc.bands];
    [next[i], next[target]] = [next[target], next[i]];
    set("bands", next);
  };

  const resolved = resolveBands(doc.bands);

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="no-print flex flex-col gap-3.5">
        <SectionCard>
          <SectionTitle>Registry Details</SectionTitle>
          <div className="flex flex-col gap-3">
            <FieldSelect label="Fund Classification" value={doc.fund} onChange={(v) => set("fund", v)} options={FUND_OPTIONS} />
            <div className="grid grid-cols-2 gap-2">
              <FieldInput label="Fiscal Year" value={doc.fiscalYear} onChange={(v) => set("fiscalYear", v)} placeholder="2025" />
              <FieldInput label="F.P.P. Code" value={doc.fppCode} onChange={(v) => set("fppCode", v)} placeholder="1071" />
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Ledger Rows</SectionTitle>
          <div className="flex flex-col gap-3">
            {doc.bands.map((band, i) => (
              <BandEditor
                key={i}
                band={band}
                index={i}
                onChange={(patch) => set("bands", doc.bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))}
                onRemove={() => set("bands", doc.bands.filter((_, idx) => idx !== i))}
                onMove={(delta) => moveBand(i, delta)}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="ghost" small onClick={() => addBand("released")}>
              + Allotment Released
            </Btn>
            <Btn variant="ghost" small onClick={() => addBand("entry")}>
              + Obligation
            </Btn>
            <Btn variant="ghost" small onClick={() => addBand("supplemental")}>
              + Supplemental
            </Btn>
            <Btn variant="ghost" small onClick={() => addBand("expensesThisDate")}>
              + Expenses This Date
            </Btn>
            <Btn variant="ghost" small onClick={() => addBand("expensesToDate")}>
              + Expenses To Date
            </Btn>
            <Btn variant="ghost" small onClick={() => addBand("allotmentBalances")}>
              + Allotment Balances
            </Btn>
          </div>

          <div className="mt-3 w-28">
            <FieldInput label="Blank rows" value={doc.pad} onChange={(v) => set("pad", v)} placeholder="3" />
          </div>
        </SectionCard>

        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
      </div>

      <PaperSheet orientation="landscape">
        <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ width: 90, borderBottom: "1px solid #000", alignSelf: "flex-end", textAlign: "center" }}>
            {doc.fppCode}
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Registry of Appropriations, Allotments and Obligations</div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>Personal Services</div>
            <div style={{ fontSize: 11 }}>Municipality of San Pascual</div>
            <div style={{ fontSize: 10 }}>
              {doc.fund}
              {doc.fiscalYear ? ` — CY ${doc.fiscalYear}` : ""}
            </div>
          </div>
          <div style={{ width: 150, border: "1px solid #000", padding: "3px 6px", textAlign: "center", fontSize: 9 }}>
            MUNICIPAL BUDGET OFFICE
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 7, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "3%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "3%" }} />
            <col style={{ width: "6%" }} />
            {ACCOUNTS.map((account) => (
              <col key={account.key} style={{ width: `${69 / ACCOUNTS.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={cellHead} rowSpan={4}>
                Date
              </th>
              <th style={cellHead}>Reference</th>
              <th style={rotated} rowSpan={4}>
                Appropriation
              </th>
              <th style={cellHead} rowSpan={4}>
                Allotment
              </th>
              <th style={rotated} rowSpan={4}>
                Bal of Appropriation
              </th>
              <th style={cellHead} rowSpan={4}>
                TOTALS
              </th>
              <th style={cellHead} colSpan={ACCOUNTS.length}>
                Obligations Incurred
              </th>
            </tr>
            <tr>
              <th style={cellHead} rowSpan={3}>
                AO/AA/
              </th>
              {ACCOUNTS_LEAD.map((account) => (
                <th key={account.key} style={cellHead} rowSpan={2}>
                  {account.name}
                </th>
              ))}
              <th style={cellHead} colSpan={ACCOUNTS_OTHER_BENEFITS.length}>
                other personnel benefits
              </th>
              {ACCOUNTS_TRAIL.map((account) => (
                <th key={account.key} style={cellHead} rowSpan={2}>
                  {account.name}
                </th>
              ))}
            </tr>
            <tr>
              {ACCOUNTS_OTHER_BENEFITS.map((account) => (
                <th key={account.key} style={cellHead}>
                  {account.name}
                </th>
              ))}
            </tr>
            <tr>
              {ACCOUNTS.map((account) => (
                <th key={account.key} style={{ ...cellHead, fontWeight: 400 }}>
                  {account.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resolved.map(({ band, totals }, i) => (
              <BandRow key={i} band={band} totals={totals} />
            ))}
            <FillerRows count={parseAmount(doc.pad)} cols={COLS} />
          </tbody>
        </table>
      </PaperSheet>
    </div>
  );
}
