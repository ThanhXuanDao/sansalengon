import { useQuery } from "@tanstack/react-query"

export function useCouponCounts(): Record<string, number> {
  const { data } = useQuery<Record<string, number>>({
    queryKey: ["coupon-counts"],
    queryFn: async () => {
      const res = await fetch("/api/coupons/counts")
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  return data ?? {}
}
