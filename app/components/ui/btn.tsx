import type { ReactNode } from "react";
import Link from "next/link";

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<BtnVariant, string> = {
  primary: "bg-[#1F3864] text-white border border-[#1F3864]",
  secondary: "bg-white text-[#1F3864] border border-[#1F3864]",
  ghost: "bg-transparent text-[#2E74B5] border border-[#D1D9E6]",
  danger: "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]",
};

export function Btn({
  children,
  variant = "primary",
  small,
  icon,
  href,
  className,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  small?: boolean;
  icon?: ReactNode;
  href?: string;
  className?: string;
}) {
  const classes = `inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-opacity hover:opacity-85 ${
    small ? "px-3 py-1 text-xs" : "px-4 py-2 text-[13px]"
  } ${variantClasses[variant]} ${className ?? ""}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes}>
      {icon}
      {children}
    </button>
  );
}
