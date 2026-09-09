import { useQuery } from "@tanstack/react-query"
import { fetchMostClickedProducts } from "@/lib/services/products"
import type { Product } from "@/types"

export function useMostClickedProducts() {
  return useQuery<Product[]>({
    queryKey: ["products", "most-clicked"],
    queryFn: () => fetchMostClickedProducts(6),
    placeholderData: (prev) => prev,
  })
}
