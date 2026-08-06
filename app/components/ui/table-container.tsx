import type { ReactNode } from "react";

export function TableContainer({ children }: { children: ReactNode }) {
  return <div className="bg-white border border-[#D1D9E6] rounded-lg overflow-hidden">{children}</div>;
}
