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

const BannerSlider = dynamic(() => import("@/components/sections/BannerSlider"))
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
      <section className="w-full bg-gray-50 border-t border-gray-100" aria-label="Giới thiệu Săn Sale Ngon">
        <div className="max-w-[1320px] mx-auto px-3 py-8 md:py-10">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 mb-4 leading-snug">
            Săn Sale Ngon — Giảm Giá Ngay Hàng Ngàn Sản Phẩm Chính Hãng
          </h1>
          <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
            <p>
              Săn Sale Ngon là nền tảng tổng hợp deal giảm giá từ các thương hiệu và sàn thương mại điện tử lớn tại Việt Nam như Shopee, Lazada, Tiki và nhiều nguồn khác. Thay vì mất hàng giờ lướt qua nhiều trang web để tìm sản phẩm tốt giá rẻ, bạn chỉ cần truy cập một nơi duy nhất để xem tất cả những gì đang được giảm giá mạnh nhất trong ngày.
            </p>
            <p>
              Trang web cập nhật hàng nghìn sản phẩm tự động liên tục, bao gồm thời trang nam nữ, điện thoại và thiết bị công nghệ, đồ gia dụng thông minh, mỹ phẩm chính hãng, giày dép thể thao và nhiều danh mục khác. Mỗi sản phẩm đều hiển thị phần trăm giảm giá, giá gốc và giá sale rõ ràng, giúp bạn so sánh và đưa ra quyết định mua hàng thông minh hơn.
            </p>
            <p>
              Sử dụng bộ lọc theo danh mục sản phẩm, thương hiệu yêu thích và sắp xếp theo mức giảm giá cao nhất hoặc mới nhất. Các deal flash sale, chương trình khuyến mãi có hạn và sản phẩm giảm sâu đến 50–70% được cập nhật ngay khi có, đảm bảo bạn không bỏ lỡ bất kỳ ưu đãi hấp dẫn nào. Theo dõi kênh Zalo OA của Săn Sale Ngon để nhận thông báo deal mới nhất mỗi ngày và khám phá hàng nghìn sản phẩm giảm giá từ các thương hiệu uy tín tại Việt Nam — tất cả link mua hàng đều dẫn thẳng đến sàn thương mại điện tử, an toàn và tiện lợi.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}
