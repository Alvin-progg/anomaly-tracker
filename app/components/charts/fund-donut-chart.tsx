"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORICAL, GRID } from "./palette";
import { formatPesoCompact, percentOf } from "@/app/lib/budget/format";

export interface FundDatum {
  fund: string;
  shortCode: string;
  appropriated: number;
}

/**
 * Appropriation split across the fund classifications. A donut is legitimate here and only here:
 * part-to-whole, three segments, read at a glance — and the values are far enough apart that the
 * arcs are not being asked to support a close comparison.
 *
 * Every segment is direct-labelled in the legend below with its peso value and share, which is
 * also the required relief for the aqua slot sitting under 3:1 against white — no segment depends
 * on colour alone.
 */
export function FundDonutChart({ data }: { data: FundDatum[] }) {
  if (data.length === 0) {
    return <div className="h-[180px] flex items-center justify-center text-xs text-[#6B7A99]">No appropriations recorded for this fiscal year yet.</div>;
  }

  const total = data.reduce((sum, row) => sum + row.appropriated, 0);
  const colored = data.map((row, index) => ({ ...row, color: CATEGORICAL[index % CATEGORICAL.length] }));

  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={colored}
            dataKey="appropriated"
            nameKey="fund"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={2}
            stroke="none"
          >
            {colored.map((row) => (
              <Cell key={row.shortCode} fill={row.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatPesoCompact(Number(value)), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul className="flex flex-col gap-1.5 mt-1">
        {colored.map((row) => (
          <li key={row.shortCode} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: row.color }} />
            <span className="text-[#374151] flex-1">{row.fund}</span>
            <span className="font-mono text-[11px] text-[#6B7A99]">
              {formatPesoCompact(row.appropriated)}
              {percentOf(row.appropriated, total) ? ` · ${percentOf(row.appropriated, total)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
