"use client"

import { useCallback, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { BookOpen, ChevronRight, Tag } from "lucide-react"
import Navbar from "@/components/layout/Navbar"
import { useProducts } from "@/hooks/useProducts"
import type { NicheConfig } from "@/lib/niches"
import type { Product } from "@/types"
import type { Coupon } from "@/components/coupons/CouponCard"
import type { BlogPostMeta } from "@/content/blog"

const ProductGrid = dynamic(() => import("@/components/sections/ProductGrid"), {
  loading: () => <div className="h-96 skeleton-shimmer" />,
})
const CouponCard = dynamic(() => import("@/components/coupons/CouponCard"))
const Footer = dynamic(() => import("@/components/layout/Footer"))
const MobileBottomNav = dynamic(() => import("@/components/layout/MobileBottomNav"), { ssr: false })

interface Props {
  niche: NicheConfig
  initialProducts: { data: Product[]; total: number }
  initialCoupons: Coupon[]
  blogPosts?: BlogPostMeta[]
}

export default function NichePageClient({ niche, initialProducts, initialCoupons, blogPosts = [] }: Props) {
  const [sort, setSort] = useState("discount_desc")

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categorySlug: niche.categorySlug,
    sort,
  })

  // Client data augments SSR initial data on first render
  const allProducts = useMemo(
    () => (data.data.length > 0 ? data.data : initialProducts.data),
    [data.data, initialProducts.data]
  )
  const total = data.total || initialProducts.total

  const handleBuyProduct = useCallback((productId: string) => {
    window.open(`/api/affiliate/redirect/${productId}?src=website`, "_blank")
  }, [])

  const handleSortChange = useCallback((s: string) => setSort(s), [])
  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage])

  const coupons = initialCoupons

  return (
    <>
      <Navbar onSearch={() => {}} searchQuery="" />

      <div className="w-full bg-white border-t border-dashed border-border-color">
        <main className="w-full max-w-[1320px] mx-auto px-3 py-10 pb-24 lg:pb-10">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-xs text-ink/40 mb-6">
            <Link href="/" className="hover:text-primary transition-colors">Trang chủ</Link>
            <ChevronRight className="size-3" />
            <span className="text-ink/70 font-bold">{niche.emoji} {niche.name}</span>
          </nav>

          {/* Hero ngách */}
          <div className="mb-8 p-5 brutalist-border bg-[#fafaf7]">
            <h1 className="font-bold text-2xl text-ink mb-1">
              {niche.emoji} Deal {niche.name} hôm nay
            </h1>
            <p className="font-mono text-sm text-ink/50 max-w-xl">{niche.description}</p>
            <p className="font-mono text-xs text-ink/30 mt-2">
              {total > 0 ? `${total} sản phẩm đang giảm giá` : "Đang cập nhật..."}
              {" · "}cập nhật mỗi 4 giờ
            </p>
          </div>

          {/* Coupon strip — hiện nếu có */}
          {coupons.length > 0 && (
            <section className="mb-8" aria-label="Mã giảm giá">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Tag className="size-4 text-primary" />
                  <h2 className="font-bold text-sm text-ink uppercase tracking-wide">
                    Mã giảm giá {niche.name}
                  </h2>
                </div>
                <Link
                  href={`/ma-giam-gia?niche=${niche.id}`}
                  className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Xem tất cả <ChevronRight className="size-3" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coupons.map((c) => (
                  <CouponCard key={c.id} coupon={c} />
                ))}
              </div>
            </section>
          )}

          {/* Product grid */}
          <section aria-label={`Sản phẩm ${niche.name}`}>
            <ProductGrid
              allProducts={allProducts}
              total={total}
              onBuyProduct={handleBuyProduct}
              isLoading={isLoading && allProducts.length === 0}
              error={error?.message}
              sort={sort}
              onSortChange={handleSortChange}
              hasMore={hasNextPage}
              onLoadMore={handleLoadMore}
              isLoadMoreLoading={isFetchingNextPage}
            />
          </section>

          {/* Blog widget */}
          {blogPosts.length > 0 && (
            <section className="mt-12" aria-label={`Blog ${niche.name}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-[#b51c00]" />
                  <h2 className="font-mono text-[13px] font-bold text-[#1a1c1b] uppercase tracking-wider">
                    Bài viết về {niche.name}
                  </h2>
                </div>
                <Link
                  href={`/${niche.id}/blog`}
                  className="font-mono text-[11px] text-[#b51c00] hover:underline flex items-center gap-1"
                >
                  Tất cả bài <ChevronRight className="size-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {blogPosts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/${niche.id}/blog/${post.slug}`}
                    className="group flex gap-3 p-3 bg-white border border-border-color hover:border-[#b51c00]/40 hover:bg-[#fffdf5] transition-colors"
                  >
                    {post.coverImage && (
                      <div className="shrink-0 w-16 h-16 overflow-hidden border border-border-color">
                        <img
                          src={post.coverImage}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] font-bold text-[#1a1c1b] leading-snug line-clamp-2 group-hover:text-[#b51c00] transition-colors mb-1">
                        {post.title}
                      </p>
                      <p className="font-mono text-[10px] text-ink/40">
                        {post.readTime} phút đọc
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* SEO text */}
          <div className="mt-8 p-4 border border-dashed border-border-color bg-[#fafaf7]">
            <p className="font-mono text-xs text-ink/50 leading-relaxed">
              <strong className="text-ink/70">Về trang {niche.name}:</strong>{" "}
              Hệ thống tự động thu thập và cập nhật deal {niche.name.toLowerCase()} từ
              Shopee, Lazada, KingFoodMart và hơn 50 thương hiệu mỗi 4 giờ. Biểu đồ lịch sử giá
              30 ngày giúp bạn phát hiện "sale ảo". Mã giảm giá được kiểm tra hàng ngày
              và tự động xóa khi hết hạn.
            </p>
          </div>
        </main>
      </div>

      <Footer />
      <MobileBottomNav />
    </>
  )
}
