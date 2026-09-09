import { useQuery } from "@tanstack/react-query"
import { fetchSettings } from "@/lib/services/settings"
import type { StoreSettings } from "@/lib/services/settings"

export function useSettings() {
  return useQuery<StoreSettings>({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  })
}
