import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** light = dark text on light bg (default) | dark = white text on dark/hero bg */
  variant?: "light" | "dark"
  className?: string
}

export default function Breadcrumb({ items, variant = "light", className = "" }: BreadcrumbProps) {
  const baseClass = "flex items-center gap-1.5 font-mono flex-wrap"
  const sizeClass = "text-[11px]"

  const linkClass =
    variant === "dark"
      ? "text-white/50 hover:text-white/80 transition-colors"
      : "text-site-ink/40 hover:text-site-red transition-colors"

  const sepClass =
    variant === "dark" ? "text-white/30 size-3 shrink-0" : "text-site-ink/25 size-3 shrink-0"

  const currentClass =
    variant === "dark" ? "text-white/70 font-medium" : "text-site-ink/70 font-medium"

  return (
    <nav aria-label="Breadcrumb" className={`${baseClass} ${sizeClass} ${className}`}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className={sepClass} />}
            {isLast || !item.href ? (
              <span className={isLast ? currentClass : linkClass}>{item.label}</span>
            ) : (
              <Link href={item.href} className={linkClass}>
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
