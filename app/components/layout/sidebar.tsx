"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/app/lib/auth/gotrue";
import { logoutAction } from "@/app/lib/auth/actions";
import { Icon } from "./icons";
import { navForRole, roleLabel } from "./nav-config";

function isActiveHref(pathname: string, href: string): boolean {
  return href === "/admin" || href === "/personnel" ? pathname === href : pathname.startsWith(href);
}

export function Sidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const nav = navForRole(role);

  return (
    <aside className="w-[236px] min-w-[236px] h-screen sticky top-0 flex flex-col overflow-hidden bg-[#1F3864]">
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E74B5] to-[#4A9FD5] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">RAAO Monitor</div>
            <div className="text-white/50 text-[10px] leading-tight">San Pascual Budget Office</div>
          </div>
        </div>
        <div className="bg-white/10 rounded text-[10px] font-medium tracking-wider uppercase text-[#7EB3E0] px-2 py-1">
          {roleLabel[role]}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {nav.map((item) => {
          const active = isActiveHref(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 mb-0.5 rounded-md text-[13px] border-l-[3px] transition-colors ${
                active
                  ? "bg-[#2E74B5]/35 text-white font-semibold border-l-[#4A9FD5]"
                  : "text-white/65 font-normal border-l-transparent hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Icon name={item.icon} className={active ? "opacity-100" : "opacity-70"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-white/55 hover:bg-[#FF5050]/15 hover:text-[#FF8080] transition-colors"
          >
            <Icon name="logout" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
