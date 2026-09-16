import type { ReactNode } from "react"
import { Search } from "lucide-react"

interface SearchConfig {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}

interface AdminFilterBarProps {
  search?: SearchConfig
  filters?: ReactNode
  actions?: ReactNode
  className?: string
}

export function AdminFilterBar({ search, filters, actions, className = "" }: AdminFilterBarProps) {
  return (
    <div className={`flex flex-wrap items-end gap-3 bg-white border border-[#e5e1d8] px-4 py-3 ${className}`}>
      {search && (
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <label
            htmlFor={search.id ?? "filter-search"}
            className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1"
          >
            Tìm kiếm
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#906f69]"
              aria-hidden="true"
            />
            <input
              id={search.id ?? "filter-search"}
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Tìm kiếm..."}
              className="w-full border border-[#e5e1d8] bg-white pl-8 pr-3 py-2 font-mono text-[13px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
            />
          </div>
        </div>
      )}

      {filters && (
        <div className="flex flex-wrap items-end gap-3">
          {filters}
        </div>
      )}

      {actions && (
        <div className="flex items-center gap-2 ml-auto">
          {actions}
        </div>
      )}
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  id?: string
  className?: string
}

export function FilterSelect({ label, value, onChange, options, id, className = "" }: FilterSelectProps) {
  return (
    <div className={`flex flex-col gap-1 min-w-[160px] ${className}`}>
      <label
        htmlFor={id ?? `filter-${label}`}
        className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id ?? `filter-${label}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border border-[#e5e1d8] bg-white px-3 py-2 pr-8 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[#5c403a]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
