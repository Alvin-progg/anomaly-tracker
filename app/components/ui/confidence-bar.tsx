/**
 * Distinct from ProgressBar: that component's thresholds mean "bad at high" (utilization), while
 * a higher AI confidence is more certain, not worse — opposite semantics, so this is its own
 * small component rather than a ProgressBar variant.
 */
export function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? "#DC2626" : value >= 70 ? "#D97706" : "#2E74B5";
  return (
    <div className="h-1 bg-[#E8ECF1] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}
