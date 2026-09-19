"use client"

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import Navbar from "@/components/layout/Navbar"
import Hero from "@/components/sections/Hero"
import { useProducts } from "@/hooks/useProducts"
import { useMostClickedProducts } from "@/hooks/useMostClickedProducts"
import { useCategories } from "@/hooks/useCategories"
import { useSources } from "@/hooks/useSources"
import { useSettings } from "@/hooks/useSettings"
import NotificationBanner from "@/components/sections/NotificationBanner"
import FeedbackSection from "@/components/sections/FeedbackSection"
import FeaturedSection from "@/components/sections/FeaturedSection"

const TrendingWidget = dynamic(() => import("@/components/sections/TrendingWidget"), {
  ssr: false,
})
const ProductGrid = dynamic(() => import("@/components/sections/ProductGrid"), {
  loading: () => <div className="h-96 skeleton-shimmer" />,
})
const Footer = dynamic(() => import("@/components/layout/Footer"))
const MobileBottomNav = dynamic(() => import("@/components/layout/MobileBottomNav"), { ssr: false })

export default function Home() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [sort, setSort] = useState<string>("discount_desc")
  const [searchQuery, setSearchQuery] = useState("")

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categorySlugs: selectedCategories.length > 0 ? selectedCategories : undefined,
    sourceSlugs: selectedSources.length > 0 ? selectedSources : undefined,
    sort,
    q: searchQuery || undefined,
  })

  const { data: categories, isLoading: isCategoriesLoading } = useCategories()
  const { data: sources, isLoading: isSourcesLoading } = useSources()
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
    setSelectedCategories([])
    setSelectedSources([])
    setSort("newest")
    setSearchQuery("")
  }, [])

  const handleCategoryChange = useCallback((slug: string) => {
    setSelectedCategories(prev =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }, [])

  const handleSourceChange = useCallback((slug: string) => {
    setSelectedSources(prev =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
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
      <FeaturedSection products={topRatedProducts} isLoading={isTopRatedLoading} onBuyProduct={handleBuyProduct} />
      <div className="w-full bg-white">
      <main id="skip-target" className="flex-grow w-full max-w-[1320px] mx-auto px-3 py-12 pb-24 lg:pb-12">
        <div id="products">
          <ProductGrid
            allProducts={allProducts}
            total={total}
            onBuyProduct={handleBuyProduct}
            isLoading={isLoading}
            error={error?.message}
            onResetCategory={resetFilters}
            sort={sort}
            onSortChange={handleSortChange}
            hasMore={hasNextPage}
            onLoadMore={handleLoadMore}
            isLoadMoreLoading={isFetchingNextPage}
            categories={categories}
            activeSlugs={selectedCategories}
            onCategoryChange={handleCategoryChange}
            isCategoriesLoading={isCategoriesLoading}
            sources={sources}
            activeSources={selectedSources}
            onSourceChange={handleSourceChange}
            isSourcesLoading={isSourcesLoading}
          />
        </div>
      </main>
      </div>
      <FeedbackSection />
      <Footer />
      <MobileBottomNav />
    </>
  )
}
