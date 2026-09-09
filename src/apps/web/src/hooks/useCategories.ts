import { useQuery } from "@tanstack/react-query"
import { fetchCategories } from "@/lib/services/categories"
import type { Category } from "@/types"

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })
}
