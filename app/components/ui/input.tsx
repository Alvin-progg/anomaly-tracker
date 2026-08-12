export function Input({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  disabled,
  step,
  min,
  accept,
}: {
  label?: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  step?: string;
  min?: string;
  accept?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={name} className="text-xs font-semibold text-gray-700">{label}</label>}
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        step={step}
        min={min}
        accept={accept}
        className="px-3 py-2 border border-[#D1D9E6] rounded-md text-[13px] text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors w-full disabled:bg-[#F8FAFC] disabled:text-[#6B7A99]"
      />
    </div>
  );
}
