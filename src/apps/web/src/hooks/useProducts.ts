import { useInfiniteQuery } from "@tanstack/react-query"
import { fetchProducts } from "@/lib/services/products"
import { useMemo } from "react"
import type { Product } from "@/types"

const PAGE_SIZE = 16

interface UseProductsOptions {
  categorySlugs?: string[]
  sourceSlugs?: string[]
  sort?: string
  numberFrom?: number
  numberTo?: number
  q?: string
}

export function useProducts(options?: UseProductsOptions) {
  const { categorySlugs, sourceSlugs, sort, numberFrom, numberTo, q } = options ?? {}
  const categoryKey = categorySlugs?.join(",") ?? "all"
  const sourceKey = sourceSlugs?.join(",") ?? "all"

  const query = useInfiniteQuery({
    queryKey: ["products", "paginated", categoryKey, sourceKey, sort ?? "discount_desc", numberFrom ?? 0, numberTo ?? 0, q ?? ""],
    queryFn: ({ pageParam }) =>
      fetchProducts(
        categorySlugs,
        sort,
        pageParam.skip,
        pageParam.take,
        numberFrom,
        numberTo,
        q,
        sourceSlugs,
      ),
    initialPageParam: { skip: 0, take: PAGE_SIZE },
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.data.length, 0)
      if (fetched >= lastPage.total) return undefined
      return { skip: fetched, take: PAGE_SIZE }
    },
    placeholderData: (prev) => prev,
    staleTime: 30000,
  })

  const products = useMemo(() => query.data?.pages.flatMap(p => p.data) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0

  return {
    data: { data: products, total },
    isLoading: query.isLoading,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
