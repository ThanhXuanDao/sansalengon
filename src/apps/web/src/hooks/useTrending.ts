import { useQuery } from "@tanstack/react-query"
import type { Product } from "@/types"

export type TrendingProduct = Product & { viewCount: number }

interface TrendingResponse {
  data: TrendingProduct[]
  windowHours: number
  total: number
}

async function fetchTrending(): Promise<TrendingResponse> {
  const res = await fetch("/api/trending")
  if (!res.ok) throw new Error("Failed to fetch trending")
  const json = await res.json()
  // Normalize missing optional fields
  return {
    ...json,
    data: json.data.map((p: TrendingProduct) => ({
      ...p,
      imageAlt: p.imageAlt ?? p.name,
      originalPrice: p.originalPrice ?? null,
      externalId: p.externalId ?? null,
      lastSyncedAt: p.lastSyncedAt ?? null,
      number: p.number ?? 0,
      clicks: p.clicks ?? [],
    })),
  }
}

export function useTrending() {
  return useQuery<TrendingResponse>({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}
