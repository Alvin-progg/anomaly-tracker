"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TEXT, GRID, NEUTRAL, SERIES_PRIMARY, SURFACE } from "./palette";
import { formatPesoAxis, formatPesoCompact, percentOf } from "@/app/lib/budget/format";

export interface UtilizationDatum {
  department: string;
  shortCode: string;
  appropriated: number;
  obligated: number;
}

/**
 * Obligated vs still-unobligated appropriation, one stacked bar per department.
 *
 * Stacked rather than the side-by-side pair the mock used: obligations are a *part of* the
 * appropriation, so two bars of the same height would read as two independent quantities and
 * invite double-counting. Stacked, each bar's full height is the department's appropriation and
 * the blue portion is what has actually been committed.
 *
 * The x axis carries office short codes, with the full name in the tooltip — the mock's rotated
 * full names collided at this width.
 */
export function UtilizationBarChart({ data }: { data: UtilizationDatum[] }) {
  if (data.length === 0) {
    return <div className="h-[240px] flex items-center justify-center text-xs text-[#6B7A99]">No department records for this fiscal year yet.</div>;
  }

  const rows = data.map((row) => ({
    shortCode: row.shortCode,
    department: row.department,
    appropriated: row.appropriated,
    obligated: row.obligated,
    unobligated: Math.max(row.appropriated - row.obligated, 0),
  }));

  const byShortCode = new Map(rows.map((row) => [row.shortCode, row]));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        {/* Horizontal rules only, solid hairline one shade off the surface — never dashed. */}
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="shortCode"
          tick={{ fontSize: 11, fill: AXIS_TEXT }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <YAxis
          tickFormatter={formatPesoAxis}
          tick={{ fontSize: 11, fill: AXIS_TEXT }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "#F8FAFC" }}
          formatter={(value, name) => [formatPesoCompact(Number(value)), name]}
          labelFormatter={(label) => {
            const row = byShortCode.get(String(label));
            if (!row) return label;
            const rate = percentOf(row.obligated, row.appropriated);
            return `${row.department}${rate ? ` — ${rate} utilised` : ""}`;
          }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="square"
          iconSize={9}
          wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }}
        />
        {/* The 2px surface-coloured stroke is the seam between the two fills — a gap, not a border. */}
        <Bar dataKey="obligated" name="Obligated" stackId="dept" fill={SERIES_PRIMARY} />
        <Bar
          dataKey="unobligated"
          name="Not yet obligated"
          stackId="dept"
          fill={NEUTRAL}
          stroke={SURFACE}
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
