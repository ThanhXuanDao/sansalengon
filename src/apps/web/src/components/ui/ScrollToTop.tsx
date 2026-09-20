"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"

const SHOW_THRESHOLD = 320

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_THRESHOLD)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
      className="fixed bottom-6 right-4 z-50 size-10 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary/90 transition-colors cursor-pointer"
    >
      <ArrowUp className="size-4" aria-hidden="true" />
    </button>
  )
}
