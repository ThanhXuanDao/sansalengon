import type { ReactNode } from "react"

interface AdminPageShellProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

export default function AdminPageShell({ title, subtitle, actions }: AdminPageShellProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dashed border-[#e5beb6]">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1c1b]">{title}</h1>
        {subtitle && <p className="text-sm text-[#5c403a] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  )
}
