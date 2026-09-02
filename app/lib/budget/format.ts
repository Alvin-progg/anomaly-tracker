/**
 * Peso formatting for the budget modules. Kept next to the data layer rather than in a component
 * so the KPI cards, the chart axes and the chart tooltips cannot drift apart on rounding.
 */

/** Headline form: ₱22.45M / ₱830.00K / ₱940.00 — for KPI values and chart tooltips. */
export function formatPesoCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `₱${(amount / 1_000).toFixed(2)}K`;
  return `₱${amount.toFixed(2)}`;
}

/** Ledger form: ₱22,450,000.00 — for anything that has to reconcile against a record. */
export function formatPeso(amount: number): string {
  return `₱${formatAmount(amount)}`;
}

/**
 * Paper form: 22,450,000.00, no currency symbol. The government forms never print ₱ inside a
 * table cell — see the scans behind app/components/ui/paper.tsx — so anything rendered onto one
 * uses this and not formatPeso.
 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Axis form: one decimal, no currency noise repeated down the axis. */
export function formatPesoAxis(amount: number): string {
  return `₱${(amount / 1_000_000).toFixed(1)}M`;
}

/** Returns null rather than "0.0%" when the denominator is zero — nothing to report, not zero. */
export function percentOf(part: number, whole: number): string | null {
  if (!whole) return null;
  return `${((part / whole) * 100).toFixed(1)}%`;
}
