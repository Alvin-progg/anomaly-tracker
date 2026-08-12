export function Select({
  label,
  name,
  defaultValue,
  options,
  required,
  onChange,
}: {
  label?: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
  /** For an uncontrolled select that still needs to drive a side-effect (e.g. a derived preview). */
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={name} className="text-xs font-semibold text-gray-700">{label}</label>}
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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
