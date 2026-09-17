import { useQuery } from "@tanstack/react-query"

export interface TrendingProduct {
  id: string
  name: string
  price: number
  discountPct: number | null
  imageUrl: string
  productUrl: string
  affiliateUrl: string | null
  rating: number
  viewCount: number
  category: { name: string; slug: string }
}

interface TrendingResponse {
  data: TrendingProduct[]
  windowHours: number
  total: number
}

async function fetchTrending(): Promise<TrendingResponse> {
  const res = await fetch("/api/trending")
  if (!res.ok) throw new Error("Failed to fetch trending")
  return res.json()
}

export function useTrending() {
  return useQuery<TrendingResponse>({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    staleTime: 5 * 60 * 1000,      // refetch after 5 minutes
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
    placeholderData: (prev) => prev,
  })
}
