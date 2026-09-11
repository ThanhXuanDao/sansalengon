import { forwardRef, type SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = "", id, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={`w-full appearance-none border bg-white px-3 py-2 pr-8 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00] disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? "border-[#ba1a1a]" : "border-[#e5e1d8]"
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[#5c403a]" />
      </div>
      {error && <p className="font-mono text-[11px] text-[#ba1a1a]">{error}</p>}
    </div>
  )
)
Select.displayName = "Select"
