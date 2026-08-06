type BadgeVariant = "green" | "yellow" | "red" | "blue" | "gray";

const variantClasses: Record<BadgeVariant, string> = {
  green: "bg-[#D1FAE5] text-[#065F46]",
  yellow: "bg-[#FEF3C7] text-[#92400E]",
  red: "bg-[#FEE2E2] text-[#991B1B]",
  blue: "bg-[#DBEAFE] text-[#1E40AF]",
  gray: "bg-[#F1F5F9] text-[#475569]",
};

export function Badge({ label, variant = "gray" }: { label: string; variant?: BadgeVariant }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded tracking-wide whitespace-nowrap ${variantClasses[variant]}`}
    >
      {label}
    </span>
  );
}
