import { useQuery } from "@tanstack/react-query"
import { fetchTopDiscountProducts } from "@/lib/services/products"
import type { Product } from "@/types"

export function useMostClickedProducts() {
  return useQuery<Product[]>({
    queryKey: ["products", "top-discount"],
    queryFn: () => fetchTopDiscountProducts(10),
    placeholderData: (prev) => prev,
  })
}
