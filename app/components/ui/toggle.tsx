export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`w-10 h-[22px] rounded-full relative transition-colors ${
        checked ? "bg-[#1F3864]" : "bg-[#D1D9E6]"
      } ${disabled ? "opacity-50 cursor-default" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] ${
          checked ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}
