import type { ReactNode } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

type AlertTone = "error" | "success" | "warning" | "info"

interface AlertProps {
  tone?: AlertTone
  title?: string
  children: ReactNode
  className?: string
}

const config: Record<AlertTone, { cls: string; Icon: typeof XCircle }> = {
  error:   { cls: "bg-[#ffdad6] border-[#ba1a1a]/30 text-[#ba1a1a]", Icon: XCircle },
  success: { cls: "bg-[#d4edda] border-[#155724]/30 text-[#155724]", Icon: CheckCircle2 },
  warning: { cls: "bg-[#fff3cd] border-[#856404]/30 text-[#856404]", Icon: AlertTriangle },
  info:    { cls: "bg-[#d0e4ff] border-[#004085]/30 text-[#004085]", Icon: Info },
}

export function Alert({ tone = "info", title, children, className = "" }: AlertProps) {
  const { cls, Icon } = config[tone]
  return (
    <div className={`flex gap-3 border px-4 py-3 font-mono text-[13px] ${cls} ${className}`} role="alert">
      <Icon className="size-4 shrink-0 mt-0.5" />
      <div>
        {title && <p className="font-bold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
