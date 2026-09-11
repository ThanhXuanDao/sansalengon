import { isValidElement, type ReactNode, type ElementType } from "react"

interface EmptyStateProps {
  icon?: ElementType | ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  const iconNode = !icon
    ? null
    : isValidElement(icon)
    ? icon
    : (typeof icon === "function" || typeof icon === "object")
    ? (() => { const Icon = icon as ElementType; return <Icon className="size-6" /> })()
    : icon as ReactNode

  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-3 text-center ${className}`}>
      {iconNode && (
        <div className="size-12 rounded-full bg-[#f4f4f1] flex items-center justify-center text-[#5c403a]/40">
          {iconNode}
        </div>
      )}
      <p className="font-sans text-[15px] font-bold text-[#1a1c1b]">{title}</p>
      {description && (
        <p className="font-mono text-[12px] text-[#5c403a] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
