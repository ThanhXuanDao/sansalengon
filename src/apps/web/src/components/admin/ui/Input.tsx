import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, iconLeft, iconRight, className = "", id, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5c403a]">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full border bg-white py-2 font-mono text-[13px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00] disabled:opacity-50 ${
            iconLeft ? "pl-9" : "pl-3"
          } ${iconRight ? "pr-9" : "pr-3"} ${
            error ? "border-[#ba1a1a]" : "border-[#e5e1d8]"
          } ${className}`}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c403a]">
            {iconRight}
          </span>
        )}
      </div>
      {error && <p className="font-mono text-[11px] text-[#ba1a1a]">{error}</p>}
    </div>
  )
)
Input.displayName = "Input"
