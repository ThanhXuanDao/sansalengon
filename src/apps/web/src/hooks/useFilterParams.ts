"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams, usePathname } from "next/navigation"

export const DEFAULT_SORT = "discount_desc"

// Canonical param order in URL: q → source → category → sort (sort always last)
function buildSearchString(q: string, sources: string[], categories: string[], sort: string): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (sources.length > 0) params.set("source", sources.join(","))
  if (categories.length > 0) params.set("category", categories.join(","))
  if (sort && sort !== DEFAULT_SORT) params.set("sort", sort)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

interface FilterState {
  q: string
  sources: string[]
  categories: string[]
  sort: string
}

function initFromParams(searchParams: URLSearchParams): FilterState {
  return {
    q: searchParams.get("q") ?? "",
    sources: (searchParams.get("source") ?? "").split(",").filter(Boolean),
    categories: (searchParams.get("category") ?? "").split(",").filter(Boolean),
    sort: searchParams.get("sort") ?? DEFAULT_SORT,
  }
}

export function useFilterParams() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // useState drives UI instantly — no dependency on router reactivity
  const [state, setState] = useState<FilterState>(() => initFromParams(searchParams))

  // Sync URL as a side-effect after state updates (no navigation triggered)
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      pathname + buildSearchString(state.q, state.sources, state.categories, state.sort)
    )
  }, [state, pathname])

  const setQ = useCallback((value: string) => {
    setState((prev) => ({ ...prev, q: value }))
  }, [])

  const toggleSource = useCallback((slug: string) => {
    setState((prev) => {
      const next = prev.sources.includes(slug)
        ? prev.sources.filter((s) => s !== slug)
        : [...prev.sources, slug]
      return { ...prev, sources: next }
    })
  }, [])

  const toggleCategory = useCallback((slug: string) => {
    setState((prev) => {
      const next = prev.categories.includes(slug)
        ? prev.categories.filter((s) => s !== slug)
        : [...prev.categories, slug]
      return { ...prev, categories: next }
    })
  }, [])

  const setSort = useCallback((value: string) => {
    setState((prev) => ({ ...prev, sort: value }))
  }, [])

  const resetAll = useCallback(() => {
    setState({ q: "", sources: [], categories: [], sort: DEFAULT_SORT })
  }, [])

  return {
    q: state.q,
    sources: state.sources,
    categories: state.categories,
    sort: state.sort,
    setQ,
    toggleSource,
    toggleCategory,
    setSort,
    resetAll,
  }
}
