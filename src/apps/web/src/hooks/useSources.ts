import { useQuery } from "@tanstack/react-query"

export interface SyncSourcePublic {
  id: string
  name: string
  slug: string
  icon: string | null
}

export function useSources() {
  return useQuery<SyncSourcePublic[]>({
    queryKey: ["sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources")
      if (!res.ok) throw new Error("Failed to fetch sources")
      const json = await res.json() as { data: SyncSourcePublic[] }
      return json.data
    },
    staleTime: 5 * 60 * 1000,
  })
}
