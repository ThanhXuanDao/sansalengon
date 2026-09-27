"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function useFilterUrlSync<T>(
  state: T,
  buildUrl: (pathname: string, state: T) => string,
): void {
  const pathname = usePathname()
  useEffect(() => {
    window.history.replaceState(null, "", buildUrl(pathname, state))
  }, [state, pathname, buildUrl])
}
