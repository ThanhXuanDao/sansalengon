interface Option<T extends string = string> {
  label: string
  value: T
}

interface SegmentedControlProps<T extends string = string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div className={`flex gap-1 border border-[#e5e1d8] p-1 bg-white ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-mono text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
            value === opt.value
              ? "bg-[#1a1c1b] text-[#fafaf7] font-bold"
              : "text-[#5c403a] hover:bg-[#f4f4f1]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
