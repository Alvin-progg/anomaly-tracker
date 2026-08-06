import type { ReactNode } from "react";

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[#D1D9E6] rounded-lg px-6 py-5 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[13px] font-bold text-[#1F3864] uppercase tracking-wider mb-3.5">
      {children}
    </div>
  );
}
