import { Icon } from "./icons";

export function Header({
  title,
  subtitle,
  username,
  notifCount = 0,
}: {
  title: string;
  subtitle?: string;
  username: string;
  notifCount?: number;
}) {
  return (
    <div className="h-16 shrink-0 flex items-center justify-between px-7 bg-white border-b border-[#D1D9E6]">
      <div>
        <div className="text-[17px] font-bold text-[#1A2033]">{title}</div>
        {subtitle && <div className="text-xs text-[#6B7A99] mt-px">{subtitle}</div>}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative cursor-pointer text-[#1A2033]">
          <Icon name="bell" />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#E53E3E] text-white text-[9px] font-bold flex items-center justify-center">
              {notifCount}
            </span>
          )}
        </div>

        <div className="w-px h-5 bg-[#D1D9E6]" />

        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1F3864] to-[#2E74B5] flex items-center justify-center text-white text-xs font-bold">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="text-xs font-semibold text-[#1A2033]">{username}</div>
        </div>
      </div>
    </div>
  );
}
