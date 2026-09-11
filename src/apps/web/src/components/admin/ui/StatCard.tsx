import { isValidElement, type ReactNode, type ElementType } from "react"

interface StatCardProps {
  label: string
  value: ReactNode
  sub?: string
  icon?: ElementType | ReactNode
  loading?: boolean
  accent?: string
}

export function StatCard({ label, value, sub, icon, loading, accent = "text-[#b51c00]" }: StatCardProps) {
  const iconNode = !icon
    ? null
    : isValidElement(icon)
    ? icon
    : (typeof icon === "function" || typeof icon === "object")
    ? (() => { const Icon = icon as ElementType; return <Icon className="size-5" /> })()
    : icon as ReactNode

  return (
    <div className={`bg-white border border-[#e5e1e9] p-5 flex flex-col gap-2 ${loading ? "animate-pulse" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5c403a] uppercase tracking-wider">{label}</span>
        {iconNode && <span className={accent}>{iconNode}</span>}
      </div>
      <span className="text-3xl font-bold text-[#1a1c1b] tabular-nums">
        {loading ? <span className="inline-block h-8 w-24 bg-[#e2e3e0] rounded" /> : value}
      </span>
      {sub && !loading && <span className="text-xs text-[#5c403a]">{sub}</span>}
    </div>
  )
}
