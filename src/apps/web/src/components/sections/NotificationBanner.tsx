"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

const BANNER_DISMISSED_KEY = "shopby_banner_dismissed"

export default function NotificationBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(BANNER_DISMISSED_KEY, "1")
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative w-full bg-[#FFC93C] text-[#1a1c1b] border-b-2 border-[#1a1c1b] px-4 py-3 md:py-2 shadow-[0_4px_0px_0px_rgba(26,28,27,1)]"
    >
      <div className="max-w-[1200px] mx-auto flex items-start md:items-center justify-between gap-4">
        <p className="font-mono text-[12px] md:text-[13px] leading-[18px] tracking-[0.05em]">
          *harga bisa berubah kapan saja admin cuma mengambil harga pas produk di tambahkan ke catalog mimin, selamat berbelanja
        </p>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded text-[#1a1c1b]/60 hover:text-[#1a1c1b] hover:bg-[#1a1c1b]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          aria-label="Tutup pemberitahuan"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
