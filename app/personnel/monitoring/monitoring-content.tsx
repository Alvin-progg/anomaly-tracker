import { getAccessToken } from "@/app/lib/auth/session";
import { getFundMonitoring } from "@/app/lib/budget/monitoring";
import { getDepartmentUtilization } from "@/app/lib/budget/dashboard";
import { formatPeso } from "@/app/lib/budget/format";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { TableContainer } from "@/app/components/ui/table-container";
import { ProgressBar } from "@/app/components/ui/progress-bar";

const UTILIZATION_OK = "#059669";

export async function BudgetMonitoringContent() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return <p className="text-sm text-[#6B7A99]">Session expired. Sign in again to load budget monitoring.</p>;
  }

  const [funds, departments] = await Promise.all([
    getFundMonitoring(accessToken),
    getDepartmentUtilization(accessToken),
  ]);

  const totals = funds.reduce(
    (acc, f) => ({
      appropriated: acc.appropriated + f.appropriated,
      allotted: acc.allotted + f.allotted,
      obligated: acc.obligated + f.obligated,
    }),
    { appropriated: 0, allotted: 0, obligated: 0 }
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionCard>
        <SectionTitle>Fund-Level Monitoring</SectionTitle>
        {funds.length === 0 ? (
          <p className="text-sm text-[#6B7A99]">No fund data available for the active fiscal year.</p>
        ) : (
          <TableContainer>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#1F3864] text-white/85 text-[11px] uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-semibold">Fund Classification</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Appropriation</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Allotment Released</th>
                  <th className="text-right px-4 py-2.5 font-semibold w-28">Allot. Utilization</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Total Obligations</th>
                  <th className="text-right px-4 py-2.5 font-semibold w-28">Oblig. Utilization</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Unobligated Balance</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((fund, i) => {
                  const unobligated = fund.allotted - fund.obligated;
                  return (
                    <tr
                      key={fund.fund}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"} border-t border-[#F1F5F9]`}
                    >
                      <td className="px-4 py-2.5 font-bold text-[#1F3864]">{fund.fund}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1A2033]">
                        {formatPeso(fund.appropriated)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1A2033]">
                        {formatPeso(fund.allotted)}
                      </td>
                      <td className="px-4 py-2.5">
                        <ProgressBar value={fund.allotted} max={fund.appropriated} color={UTILIZATION_OK} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1A2033]">
                        {formatPeso(fund.obligated)}
                      </td>
                      <td className="px-4 py-2.5">
                        <ProgressBar value={fund.obligated} max={fund.allotted} color={UTILIZATION_OK} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#065F46]">
                        {formatPeso(unobligated)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#1F3864] text-white">
                  <td className="px-4 py-2.5 font-bold">TOTAL</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{formatPeso(totals.appropriated)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{formatPeso(totals.allotted)}</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{formatPeso(totals.obligated)}</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {formatPeso(totals.allotted - totals.obligated)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableContainer>
        )}
      </SectionCard>

      <SectionCard>
        <SectionTitle>Department Budget Breakdown</SectionTitle>
        {departments.length === 0 ? (
          <p className="text-sm text-[#6B7A99]">No department data available for the active fiscal year.</p>
        ) : (
          <TableContainer>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#6B7A99] text-[11px] uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-semibold">Department</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Appropriation</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Utilized</th>
                  <th className="text-right px-4 py-2.5 font-semibold w-28">Utilization Rate</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const remaining = dept.appropriated - dept.obligated;
                  return (
                    <tr key={dept.department} className="border-t border-[#F1F5F9]">
                      <td className="px-4 py-2.5 font-bold text-[#1F3864]">{dept.department}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1A2033]">
                        {formatPeso(dept.appropriated)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1A2033]">
                        {formatPeso(dept.obligated)}
                      </td>
                      <td className="px-4 py-2.5">
                        <ProgressBar value={dept.obligated} max={dept.appropriated} color={UTILIZATION_OK} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#065F46]">
                        {formatPeso(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableContainer>
        )}
      </SectionCard>
    </div>
  );
}
