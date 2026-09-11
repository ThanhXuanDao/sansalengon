type Tone = "red" | "green" | "yellow" | "blue" | "gray" | "orange"

interface BadgeProps {
  tone?: Tone
  children: React.ReactNode
  className?: string
}

const tones: Record<Tone, string> = {
  red:    "bg-[#ffdad6] text-[#ba1a1a] border-[#f5c6cb]",
  green:  "bg-[#d4edda] text-[#155724] border-[#c3e6cb]",
  yellow: "bg-[#fff3cd] text-[#856404] border-[#ffeeba]",
  blue:   "bg-[#d0e4ff] text-[#004085] border-[#b8d4ff]",
  gray:   "bg-[#e2e3e0] text-[#5c403a] border-[#ced4da]",
  orange: "bg-[#ffe8d0] text-[#7a3b00] border-[#ffd0a8]",
}

export function Badge({ tone = "gray", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 font-mono text-[11px] font-bold border leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "green" : "gray"}>{active ? "Hoạt động" : "Ẩn"}</Badge>
}
