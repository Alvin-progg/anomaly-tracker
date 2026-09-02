/**
 * Shared print primitives for everything that lands inside a `.print-area` — the five government
 * forms under app/personnel/documents/ and the Report Generation preview.
 *
 * These describe *paper*, not app UI. The reference is the scanned forms the Municipal Budget
 * Office actually files (see the `sample/` folder, gitignored). Two rules follow from that and are
 * the reason this file exists at all:
 *
 *  - Black on white, hairline black rules. No navy `#1F3864` fills and no white-on-navy header
 *    rows anywhere inside a `.print-area` — that was the Figma mock's styling, not the form's, and
 *    it burns toner on a document nobody reads on a screen.
 *  - No `₱` glyph inside a table cell. The forms print bare grouped figures (`3,296,825.14`), so
 *    `formatPeso` from app/lib/budget/format.ts is wrong here; it stays for on-screen app chrome.
 *
 * The left-hand editor panel of each form is ordinary app UI and keeps using SectionCard / Btn /
 * FieldInput. Only what lands inside `.print-area` comes from here.
 */

import { formatAmount } from "@/app/lib/budget/format";

const paperFont: React.CSSProperties = {
  fontFamily: '"Times New Roman", Times, serif',
  color: "#000",
};

/** Body cell. Hairline black rule on every side, as on the ruled forms. */
export const cell: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px 6px",
  verticalAlign: "top",
};

/** Header cell — same rule, centred, bold. Deliberately no background. */
export const cellHead: React.CSSProperties = {
  ...cell,
  textAlign: "center",
  fontWeight: 700,
  verticalAlign: "middle",
};

export const cellRight: React.CSSProperties = { ...cell, textAlign: "right" };
export const cellCenter: React.CSSProperties = { ...cell, textAlign: "center" };

/** The colours the RAAO registry uses to separate its row bands. See raao-ledger-document.tsx. */
export const BAND_COLOR = {
  budget: "#1F3864",
  expense: "#C00000",
  balance: "#0070C0",
  supplemental: "#00802B",
  entry: "#000000",
} as const;

/**
 * Row counts, not money. `parseAmount` used to read the "Blank rows" fields, which meant `1e4`
 * rendered ten thousand rows and `2.7` rendered two.
 */
export function parseRowCount(value: string, fallback = 0): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, 60);
}

/** Blank/garbage tolerant — a partly-filled form is the normal case while typing. */
export function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Grouped to 2 dp with no currency symbol: `3,296,825.14`. */
const groupAmount = formatAmount;

/**
 * A cell the user types into. Empty stays empty — the scans leave unfilled cells blank rather
 * than printing a placeholder in them.
 */
export function amountOrBlank(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const n = parseAmount(value);
  return n === 0 ? "" : groupAmount(n);
}

/**
 * A computed cell — a total, a balance. Nil prints as a plain hyphen, which is what the forms do
 * (never an em dash, and never `₱0.00`).
 */
export function amountOrDash(n: number): string {
  return n === 0 ? "-" : groupAmount(n);
}

/**
 * `As of  June 30, 2026` — the long form the SAAO and SEF sheets use. Takes the `yyyy-mm-dd` an
 * `<input type="date">` produces; returns a blank rule when nothing is set yet.
 */
export function longDate(iso: string): string {
  if (!iso) return "________________";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

/** `01/14/2025` — the RAAO registry's transaction-date format. */
export function shortDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

/**
 * Empty ruled rows. Every sample sheet is printed on a pre-ruled table that runs past the last
 * entry, so a short form still has to fill the block or it does not read as the same document.
 */
export function FillerRows({ count, cols }: { count: number; cols: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={`filler-${i}`}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} style={cell}>
              &nbsp;
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * The paper itself. `orientation="landscape"` opts into the named `@page` rule in globals.css —
 * the RAAO registry and the ABC are landscape sheets and clip at the right edge without it.
 */
export function PaperSheet({
  orientation = "portrait",
  label = "Live Preview",
  children,
}: {
  orientation?: "portrait" | "landscape";
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="no-print text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">{label}</div>
      <div
        className={`print-area bg-white border border-[#D1D9E6] rounded-lg overflow-auto ${
          orientation === "landscape" ? "landscape" : ""
        }`}
      >
        <div style={{ ...paperFont, padding: "28px 32px", fontSize: 10, background: "#FFF" }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Default signatories, from the signed ORS and ABC in `sample/`. One place rather than the three
 * files that each hardcoded a name before. Every form keeps these editable — an officer changes,
 * and a document nobody can correct is worse than one with a blank line.
 */
export const SIGNATORIES = {
  mayor: { name: "Rosario Anna Victoria D. Conti", position: "Municipal Mayor" },
  budgetOfficer: { name: "Merlita M. Yuncion", position: "Municipal Budget Officer" },
  preparer: { name: "Noemi C. Aranas", position: "Admin. Assistant II" },
} as const;

export const MUNICIPALITY = {
  republic: "Republic of the Philippines",
  province: "PROVINCE OF BATANGAS",
  municipality: "Municipality of San Pascual",
} as const;
