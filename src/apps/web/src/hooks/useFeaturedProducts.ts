import { useQuery } from "@tanstack/react-query"
import { fetchFeaturedProducts } from "@/lib/services/products"
import type { Product } from "@/types"

export function useFeaturedProducts() {
  return useQuery<Product[]>({
    queryKey: ["products", "featured"],
    queryFn: () => fetchFeaturedProducts(),
    placeholderData: (prev) => prev,
  })
}
