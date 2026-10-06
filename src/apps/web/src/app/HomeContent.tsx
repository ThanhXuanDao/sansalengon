"use client"

import { useCallback, useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import Navbar from "@/components/layout/Navbar"
import { useProducts } from "@/hooks/useProducts"
import { useFeaturedProducts } from "@/hooks/useFeaturedProducts"
import { useCategories } from "@/hooks/useCategories"
import { useSources } from "@/hooks/useSources"
import { useFilterParams } from "@/hooks/useFilterParams"
import FeaturedSection from "@/components/sections/FeaturedSection"

const BannerSlider = dynamic(() => import("@/components/sections/BannerSlider"), {
  ssr: false,
})
const ProductGrid = dynamic(() => import("@/components/sections/ProductGrid"), {
  loading: () => <div className="h-96 skeleton-shimmer" />,
})
const Footer = dynamic(() => import("@/components/layout/Footer"))

export default function HomeContent() {
  const { q, sources, categories, sort, setQ, toggleSource, toggleCategory, setSort, resetAll } = useFilterParams()

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categorySlugs: categories.length > 0 ? categories : undefined,
    sourceSlugs: sources.length > 0 ? sources : undefined,
    sort,
    q: q || undefined,
  })

  const { data: categoryList, isLoading: isCategoriesLoading } = useCategories()
  const { data: sourceList, isLoading: isSourcesLoading } = useSources("product")
  const { data: topRatedProducts, isLoading: isTopRatedLoading } = useFeaturedProducts()

  const total = data?.total ?? 0
  const allProducts = useMemo(() => data?.data ?? [], [data])

  const handleBuyProduct = useCallback((productId: string) => {
    window.open(`/api/affiliate/redirect/${productId}?src=website`, "_blank")
  }, [])

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage])

  return (
    <>
      <Navbar onSearch={setQ} searchQuery={q} />
      <div className="w-full bg-white pt-[102px] md:pt-[134px]">
        <div className="max-w-[1320px] mx-auto px-3 py-3 md:py-4">
          <BannerSlider />
        </div>
      </div>
      <FeaturedSection products={topRatedProducts} isLoading={isTopRatedLoading} onBuyProduct={handleBuyProduct} />
      <div className="w-full bg-white">
        <main id="skip-target" className="flex-grow w-full max-w-[1320px] mx-auto px-3 pt-6 pb-12">
          <div id="products">
            <ProductGrid
              allProducts={allProducts}
              total={total}
              onBuyProduct={handleBuyProduct}
              isLoading={isLoading}
              error={error?.message}
              onResetCategory={resetAll}
              sort={sort}
              onSortChange={setSort}
              hasMore={hasNextPage}
              onLoadMore={handleLoadMore}
              isLoadMoreLoading={isFetchingNextPage}
              categories={categoryList}
              activeSlugs={categories}
              onCategoryChange={toggleCategory}
              isCategoriesLoading={isCategoriesLoading}
              sources={sourceList}
              activeSources={sources}
              onSourceChange={toggleSource}
              isSourcesLoading={isSourcesLoading}
            />
          </div>
        </main>
      </div>
      <Footer />
    </>
  )
}
