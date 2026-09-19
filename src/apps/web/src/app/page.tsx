"use client"

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import Navbar from "@/components/layout/Navbar"
import Hero from "@/components/sections/Hero"
import { useProducts } from "@/hooks/useProducts"
import { useMostClickedProducts } from "@/hooks/useMostClickedProducts"
import { useCategories } from "@/hooks/useCategories"
import { useSettings } from "@/hooks/useSettings"
import NotificationBanner from "@/components/sections/NotificationBanner"
import FeedbackSection from "@/components/sections/FeedbackSection"

const TrendingWidget = dynamic(() => import("@/components/sections/TrendingWidget"), {
  ssr: false,
})
const CategoryFilter = dynamic(() => import("@/components/sections/CategoryFilter"), {
  loading: () => <div className="h-10 skeleton-shimmer" />,
})
const ProductGrid = dynamic(() => import("@/components/sections/ProductGrid"), {
  loading: () => <div className="h-96 skeleton-shimmer" />,
})
const Footer = dynamic(() => import("@/components/layout/Footer"))
const MobileBottomNav = dynamic(() => import("@/components/layout/MobileBottomNav"), { ssr: false })

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>("semua")
  const [sort, setSort] = useState<string>("discount_desc")
  const [searchQuery, setSearchQuery] = useState("")

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categorySlug:
      selectedCategory === "semua" ? undefined : selectedCategory,
    sort,
    q: searchQuery || undefined,
  })

  const { data: categories, isLoading: isCategoriesLoading } = useCategories()
  const { data: topRatedProducts, isLoading: isTopRatedLoading } = useMostClickedProducts()
  const { data: settings } = useSettings()

  const total = data?.total ?? 0
  const allProducts = useMemo(() => data?.data ?? [], [data])

  const handleBuyProduct = useCallback(
    (productId: string) => {
      window.open(`/api/affiliate/redirect/${productId}?src=website`, "_blank")
    },
    []
  )

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
  }, [])

  const resetFilters = useCallback(() => {
    setSelectedCategory("semua")
    setSort("newest")
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

  return (
    <>
      <NotificationBanner />
      <Navbar onSearch={handleSearch} searchQuery={searchQuery} />
      <Hero featuredProducts={topRatedProducts} onBuyProduct={handleBuyProduct} isFeaturedLoading={isTopRatedLoading} storeName={settings?.siteName} tagline={settings?.tagline} />
      <TrendingWidget onBuyProduct={handleBuyProduct} />
      <div className="w-full bg-white border-t border-dashed border-border-color">
      <main id="skip-target" className="flex-grow w-full max-w-[1320px] mx-auto px-3 py-12 pb-24 lg:pb-12">
        <div id="products">
        <div className="flex flex-col md:flex-row gap-8 mt-3 md:mt-0">
          <CategoryFilter
            categories={categories}
            activeSlug={selectedCategory}
            onSelect={handleCategoryChange}
            variant="sidebar"
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
            isCategoriesLoading={isCategoriesLoading}
          />
        </div>
        </div>
      </main>
      </div>
      <FeedbackSection />
      <Footer />
      <MobileBottomNav />
    </>
  )
}
