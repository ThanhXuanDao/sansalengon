"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

export default function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPathRef = useRef(pathname)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const start = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setVisible(true)
    setWidth(15)
    let w = 15
    intervalRef.current = setInterval(() => {
      // Tăng nhanh lúc đầu, chậm dần khi gần 90%
      w = Math.min(w + (90 - w) * 0.12, 90)
      setWidth(w)
    }, 150)
  }

  const finish = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setWidth(100)
    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 300)
  }

  // Hoàn thành khi pathname thay đổi
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      finish()
    }
  }, [pathname])

  // Bắt đầu khi user click một internal link
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]")
      if (!anchor) return
      const href = anchor.getAttribute("href") ?? ""
      // Bỏ qua: external, hash-only, javascript:, hoặc cùng trang
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("javascript") ||
        href === pathname
      ) return
      start()
    }

    document.addEventListener("click", handleClick)
    return () => {
      document.removeEventListener("click", handleClick)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!visible && width === 0) return null

  return (
    <div
      aria-hidden="true"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      className="fixed top-0 left-0 h-[2.5px] bg-secondary z-[9999] transition-[width] duration-150 ease-out pointer-events-none"
    />
  )
}
