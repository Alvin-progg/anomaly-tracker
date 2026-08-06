import { SessionStatus } from "./session-status";

const SYSTEM_VERSION = "v1.0.0";
const MUNICIPALITY_NAME = "Municipality of San Pascual";

export function Footer() {
  const fiscalYear = new Date().getFullYear();

  return (
    <div className="h-9 shrink-0 flex items-center justify-between px-7 bg-white border-t border-[#D1D9E6] text-[11px] text-[#6B7A99]">
      <div className="flex items-center gap-4">
        <span>{MUNICIPALITY_NAME}</span>
        <span className="w-px h-3 bg-[#D1D9E6]" />
        <span>FY {fiscalYear}</span>
      </div>
      <div className="flex items-center gap-4">
        <SessionStatus />
        <span className="w-px h-3 bg-[#D1D9E6]" />
        <span>RAAO Monitor {SYSTEM_VERSION}</span>
      </div>
    </div>
  );
}
