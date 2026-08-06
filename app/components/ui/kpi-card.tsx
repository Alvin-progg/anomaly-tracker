import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-white border border-[#D1D9E6] rounded-lg px-5 py-[18px] flex flex-col gap-1.5">
      <div className="flex justify-between items-start">
        <div className="text-xs text-[#6B7A99] font-medium">{label}</div>
        {icon && <div className="text-[#2E74B5] opacity-70">{icon}</div>}
      </div>
      <div className="text-[22px] font-bold font-mono tracking-tight text-[#1F3864]">{value}</div>
      {sub && <div className="text-[11px] text-[#6B7A99]">{sub}</div>}
    </div>
  );
}
