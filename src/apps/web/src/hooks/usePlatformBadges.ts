import { useQuery } from "@tanstack/react-query"
import type { PlatformBadge } from "@/app/api/sync-sources/badges/route"

export type { PlatformBadge }

export function usePlatformBadges() {
  return useQuery<Record<string, PlatformBadge>>({
    queryKey: ["platform-badges"],
    queryFn: async () => {
      const res = await fetch("/api/sync-sources/badges")
      if (!res.ok) return {}
      return res.json() as Promise<Record<string, PlatformBadge>>
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev ?? {},
  })
}
