"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home } from "lucide-react"
import { NICHES } from "@/lib/niches"

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 260)
    // Check immediately in case page is already scrolled (e.g. back-navigation)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const activeNiche = NICHES.find((n) => pathname.startsWith(`/${n.id}`))

  return (
    <nav
      className={`
        lg:hidden fixed bottom-0 left-0 right-0 z-50
        bg-[#1a1c1b] border-t border-[#fdc73a]/20
        h-14 flex items-stretch
        transition-transform duration-300 ease-out
        ${visible ? "translate-y-0" : "translate-y-full"}
      `}
      aria-label="Điều hướng danh mục"
    >
      {/* Home */}
      <Link
        href="/"
        aria-label="Trang chủ"
        className={`
          flex flex-col items-center justify-center gap-0.5 px-3 shrink-0
          font-mono text-[8px] transition-colors
          border-r border-white/10
          ${pathname === "/" ? "text-[#fdc73a]" : "text-white/40 hover:text-white/70 active:text-white"}
        `}
      >
        <Home className="size-4" />
        <span>Home</span>
      </Link>

      {/* Niche links — horizontal scroll */}
      <div
        className="flex-1 flex overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {NICHES.map((n) => {
          const isActive = activeNiche?.id === n.id
          return (
            <Link
              key={n.id}
              href={`/${n.id}`}
              className={`
                flex flex-col items-center justify-center gap-0.5 px-3.5 shrink-0
                font-mono text-[8px] whitespace-nowrap transition-colors
                ${isActive
                  ? "text-[#fdc73a] border-t-2 border-[#fdc73a]"
                  : "text-white/40 hover:text-white/70 active:text-white border-t-2 border-transparent"
                }
              `}
            >
              <span className="text-[16px] leading-none">{n.emoji}</span>
              <span>{n.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
