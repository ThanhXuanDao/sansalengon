import { useQuery } from "@tanstack/react-query"

export interface SyncSourcePublic {
  id: string
  name: string
  slug: string
  icon: string | null
}

export type SourceType = "coupon" | "product"

export function useSources(type?: SourceType) {
  const url = type ? `/api/sources?type=${type}` : "/api/sources"
  return useQuery<SyncSourcePublic[]>({
    queryKey: ["sources", type ?? "all"],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch sources")
      const json = await res.json() as { data: SyncSourcePublic[] }
      return json.data
    },
    staleTime: 5 * 60 * 1000,
  })
}
