export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColor = pct >= 90 ? "#DC2626" : pct >= 75 ? "#D97706" : color;
  return (
    <div>
      <div className="h-1.5 bg-[#E8ECF1] rounded-full overflow-hidden mb-0.5">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="text-[10px] text-[#6B7A99] font-mono">{pct}%</div>
    </div>
  );
}
