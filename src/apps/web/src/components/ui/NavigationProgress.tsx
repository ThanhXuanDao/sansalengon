"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useIsFetching } from "@tanstack/react-query"

export default function NavigationProgress() {
  const pathname = usePathname()
  const [navPending, setNavPending] = useState(false)
  const prevPathRef = useRef(pathname)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Fetching sản phẩm (filter / search / load-more)
  const isFetchingProducts = useIsFetching({ queryKey: ["products"] })

  const visible = navPending || isFetchingProducts > 0

  const startNav = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setNavPending(true)
  }

  const finishNav = () => {
    hideTimerRef.current = setTimeout(() => setNavPending(false), 200)
  }

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      finishNav()
    }
  }, [pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]")
      if (!anchor) return
      const href = anchor.getAttribute("href") ?? ""
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("javascript") ||
        href === pathname
      ) return
      startNav()
    }

    document.addEventListener("click", handleClick)
    return () => {
      document.removeEventListener("click", handleClick)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
    >
      <div className="size-11 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
    </div>
  )
}
