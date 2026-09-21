import { useQuery } from "@tanstack/react-query"

export interface AtCampaignOption {
  id: string
  name: string
  merchant: string
  campaignType: string
}

export function useCampaigns() {
  return useQuery<AtCampaignOption[]>({
    queryKey: ["at-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/admin/campaigns")
      if (!res.ok) throw new Error("Failed to fetch campaigns")
      const json = await res.json() as { campaigns: AtCampaignOption[] }
      return json.campaigns ?? []
    },
    staleTime: 10 * 60 * 1000,
  })
}
