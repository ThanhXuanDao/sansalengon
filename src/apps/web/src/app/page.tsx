"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import dynamic from "next/dynamic"
import Navbar from "@/components/layout/Navbar"
import Hero from "@/components/sections/Hero"
import { useProducts } from "@/hooks/useProducts"
import { useMostClickedProducts } from "@/hooks/useMostClickedProducts"
import { useCategories } from "@/hooks/useCategories"
import { useSettings } from "@/hooks/useSettings"
import { logClick } from "@/lib/services/click"
import NotificationBanner from "@/components/sections/NotificationBanner"
import FeedbackSection from "@/components/sections/FeedbackSection"
import { buildNumberRanges } from "@/lib/utils"

const CategoryFilter = dynamic(() => import("@/components/sections/CategoryFilter"), {
  loading: () => <div className="h-10 skeleton-shimmer" />,
})
const ProductGrid = dynamic(() => import("@/components/sections/ProductGrid"), {
  loading: () => <div className="h-96 skeleton-shimmer" />,
})
const Footer = dynamic(() => import("@/components/layout/Footer"))

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>("semua")
  const [sort, setSort] = useState<string>("number_asc")
  const [numberRange, setNumberRange] = useState<{ from: number; to: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categorySlug:
      selectedCategory === "semua" ? undefined : selectedCategory,
    sort,
    numberFrom: numberRange?.from,
    numberTo: numberRange?.to,
    q: searchQuery || undefined,
  })

  const { data: categories, isLoading: isCategoriesLoading } = useCategories()
  const { data: topRatedProducts, isLoading: isTopRatedLoading } = useMostClickedProducts()
  const { data: settings } = useSettings()

  const total = data?.total ?? 0
  const [globalTotal, setGlobalTotal] = useState(0)
  useEffect(() => {
    if (!numberRange && total > 0 && globalTotal !== total) {
      setGlobalTotal(total)
    }
  }, [numberRange, total, globalTotal])
  const displayTotal = numberRange ? globalTotal || total : total
  const allProducts = useMemo(() => data?.data ?? [], [data])

  const numberRanges = useMemo(() => buildNumberRanges(displayTotal), [displayTotal])

  const handleBuyProduct = useCallback(
    async (productId: string, shopeeUrl: string) => {
      window.open(shopeeUrl, "_blank")
      try {
        await logClick(productId)
      } catch {
        // Click log non-critical
      }
    },
    []
  )

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
  }, [])

  const resetFilters = useCallback(() => {
    setSelectedCategory("semua")
    setSort("newest")
    setNumberRange(null)
    setSearchQuery("")
  }, [])

  const handleCategoryChange = useCallback((slug: string) => {
    setSelectedCategory(prev => prev === slug ? "semua" : slug)
  }, [])

  const handleSortChange = useCallback((newSort: string) => {
    setSort(newSort)
  }, [])

  const handleLoadMore = useCallback(() => {
    fetchNextPage()
  }, [fetchNextPage])

  const handleRangeSelect = useCallback((range: { from: number; to: number } | null) => {
    setNumberRange(range)
  }, [])

  return (
    <>
      <NotificationBanner />
      <Navbar onSearch={handleSearch} searchQuery={searchQuery} />
      <Hero featuredProducts={topRatedProducts} onBuyProduct={handleBuyProduct} isFeaturedLoading={isTopRatedLoading} storeName={settings?.storeName} tagline={settings?.bio} />
      <div className="w-full bg-white border-t border-dashed border-border-color">
      <main id="skip-target" className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-8 py-12">
        <div id="products">
        <div className="flex flex-col md:flex-row gap-8 mt-3 md:mt-0">
          <CategoryFilter
            categories={categories}
            activeSlug={selectedCategory}
            onSelect={handleCategoryChange}
            variant="sidebar"
            numberRanges={numberRanges}
            activeRange={numberRange}
            onRangeSelect={handleRangeSelect}
            isLoading={isCategoriesLoading}
          />
          <ProductGrid
            featuredProducts={topRatedProducts}
            allProducts={allProducts}
            total={total}
            onBuyProduct={handleBuyProduct}
            isLoading={isLoading}
            isFeaturedLoading={isTopRatedLoading}
            error={error?.message}
            activeCategory={categories?.find(
              (c) => c.slug === selectedCategory
            )}
            onResetCategory={resetFilters}
            sort={sort}
            onSortChange={handleSortChange}
            hasMore={hasNextPage}
            onLoadMore={handleLoadMore}
            isLoadMoreLoading={isFetchingNextPage}
            categories={categories}
            activeSlug={selectedCategory}
            onCategoryChange={handleCategoryChange}
            numberRanges={numberRanges}
            activeRange={numberRange}
            onRangeSelect={handleRangeSelect}
            isCategoriesLoading={isCategoriesLoading}
          />
        </div>
        </div>
      </main>
      </div>
      <FeedbackSection />
      <Footer />
    </>
  )
}
