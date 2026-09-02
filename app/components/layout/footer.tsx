import { getActiveFiscalYear } from "@/app/lib/config/fiscal-years";
import { SessionStatus } from "./session-status";

const SYSTEM_VERSION = "v1.0.0";
const MUNICIPALITY_NAME = "Municipality of San Pascual";

/**
 * The year here comes from `fiscal_years`, not the wall clock. The two diverge the moment a year is
 * left open past December — this footer used to print the calendar year and sat under a dashboard
 * captioned with the real one. When no year is active, say so rather than show a plausible number.
 */
export async function Footer() {
  const activeYear = await getActiveFiscalYear();
  const fiscalYear = activeYear ? activeYear.label : "No active FY";

  return (
    <div className="h-9 shrink-0 flex items-center justify-between px-7 bg-white border-t border-[#D1D9E6] text-[11px] text-[#6B7A99]">
      <div className="flex items-center gap-4">
        <span>{MUNICIPALITY_NAME}</span>
        <span className="w-px h-3 bg-[#D1D9E6]" />
        <span>{fiscalYear}</span>
      </div>
      <div className="flex items-center gap-4">
        <SessionStatus />
        <span className="w-px h-3 bg-[#D1D9E6]" />
        <span>RAAO Monitor {SYSTEM_VERSION}</span>
      </div>
    </div>
  );
}
