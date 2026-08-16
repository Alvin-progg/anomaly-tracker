"use client";

/** Controlled sibling of app/components/ui/input.tsx — that one is defaultValue-only and can't
 * drive a live preview on every keystroke. */
export function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-700">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors"
      />
    </div>
  );
}

/** Controlled sibling of app/components/ui/select.tsx, same reasoning as FieldInput above. */
export function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-700">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none w-full bg-white cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
