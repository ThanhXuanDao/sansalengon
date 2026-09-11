"use client"

import { useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { useClickOutside } from "@/hooks/useClickOutside"

interface DropdownItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: "left" | "right"
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={`absolute z-50 mt-1 min-w-[160px] bg-white border border-[#e5e1d8] shadow-md py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 font-mono text-[13px] text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                item.danger
                  ? "text-[#ba1a1a] hover:bg-[#ffdad6]"
                  : "text-[#1a1c1b] hover:bg-[#f4f4f1]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface DropdownButtonProps extends Omit<DropdownProps, "trigger"> {
  label: string
}

export function DropdownButton({ label, ...props }: DropdownButtonProps) {
  return (
    <Dropdown
      trigger={
        <button className="flex items-center gap-2 px-4 py-2 border border-[#e5e1d8] bg-white font-mono text-[13px] text-[#1a1c1b] hover:bg-[#f4f4f1] transition-colors">
          {label}
          <ChevronDown className="size-3.5 text-[#5c403a]" />
        </button>
      }
      {...props}
    />
  )
}
