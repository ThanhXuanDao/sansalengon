"use client"

import { useCallback, useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { BookOpen, Tag, ChevronRight } from "lucide-react"
import Breadcrumb from "@/components/ui/Breadcrumb"
import Navbar from "@/components/layout/Navbar"
import { useProducts } from "@/hooks/useProducts"
import { useSources } from "@/hooks/useSources"
import { useFilterParams } from "@/hooks/useFilterParams"
import type { NicheConfig } from "@/lib/niches"
import type { Product } from "@/types"
import type { Coupon } from "@/components/coupons/CouponCard"

type BlogPostMeta = { slug: string; title: string; description: string; coverImage?: string | null; tags: string[]; readTime: number; date: string }

const ProductGrid = dynamic(() => import("@/components/sections/ProductGrid"), {
  loading: () => <div className="h-96 skeleton-shimmer" />,
})
const CouponCard = dynamic(() => import("@/components/coupons/CouponCard"))
const Footer = dynamic(() => import("@/components/layout/Footer"))

interface Props {
  niche: NicheConfig
  initialProducts: { data: Product[]; total: number }
  initialCoupons: Coupon[]
  blogPosts?: BlogPostMeta[]
}

function NicheContent({ niche, initialProducts, initialCoupons, blogPosts = [] }: Props) {
  // Category is fixed by the path — only source, q, sort come from URL params
  const { q, sources, sort, setQ, toggleSource, setSort, resetAll } = useFilterParams()

  const { data: sourceList, isLoading: isSourcesLoading } = useSources("product")

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categorySlugs: [niche.categorySlug],
    sourceSlugs: sources.length > 0 ? sources : undefined,
    q: q || undefined,
    sort,
  })

  const hasActiveFilter = sources.length > 0 || !!q
  const allProducts = useMemo(() => {
    if (data.data.length > 0) return data.data
    if (hasActiveFilter) return []
    return initialProducts.data
  }, [data.data, initialProducts.data, hasActiveFilter])
  const total = data.total || (hasActiveFilter ? 0 : initialProducts.total)

  const handleBuyProduct = useCallback((productId: string) => {
    window.open(`/api/affiliate/redirect/${productId}?src=website`, "_blank")
  }, [])

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage])

  const coupons = initialCoupons

  return (
    <>
      <Navbar onSearch={setQ} searchQuery={q} />

      <div className="w-full bg-white border-t border-dashed border-border-color">
        <main className="w-full max-w-[1320px] mx-auto px-3 pt-[120px] sm:pt-[160px] pb-10">

          <Breadcrumb
            items={[
              { label: "Trang chủ", href: "/" },
              { label: `${niche.emoji} ${niche.name}` },
            ]}
            className="mb-6"
          />

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

          {/* Product grid — category ẩn vì đã xác định bởi path */}
          <section aria-label={`Sản phẩm ${niche.name}`}>
            <ProductGrid
              allProducts={allProducts}
              total={total}
              onBuyProduct={handleBuyProduct}
              isLoading={isLoading && allProducts.length === 0}
              error={error?.message}
              onResetCategory={resetAll}
              sort={sort}
              onSortChange={setSort}
              hasMore={hasNextPage}
              onLoadMore={handleLoadMore}
              isLoadMoreLoading={isFetchingNextPage}
              sources={sourceList}
              activeSources={sources}
              onSourceChange={toggleSource}
              isSourcesLoading={isSourcesLoading}
            />
          </section>

          {/* ── Niche info banner ── */}
          <div className="mt-12 relative overflow-hidden rounded-none border border-border-color bg-gradient-to-br from-[#f7fdfb] to-[#edf7f4]">
            {/* Decorative emoji watermark */}
            <span
              aria-hidden="true"
              className="absolute right-6 top-1/2 -translate-y-1/2 text-[96px] leading-none opacity-[0.07] select-none pointer-events-none"
            >
              {niche.emoji}
            </span>

            <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-2xl">{niche.emoji}</span>
                  <h2 className="font-bold text-xl text-ink">
                    Deal {niche.name} hôm nay
                  </h2>
                </div>
                <p className="font-mono text-sm text-ink/55 max-w-lg leading-relaxed">
                  {niche.description}
                </p>
              </div>

              {/* Stats */}
              <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 shrink-0">
                <div className="text-right">
                  <p className="font-bold text-2xl tabular-nums text-primary leading-none">
                    {total > 0 ? total.toLocaleString("vi-VN") : "—"}
                  </p>
                  <p className="font-mono text-[10px] text-ink/40 uppercase tracking-wider mt-0.5">
                    sản phẩm giảm giá
                  </p>
                </div>
                <div className="w-px h-8 bg-border-color sm:hidden" />
                <div className="text-right">
                  <p className="font-bold text-base text-ink/60 leading-none">4h</p>
                  <p className="font-mono text-[10px] text-ink/40 uppercase tracking-wider mt-0.5">
                    cập nhật lần/lần
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom accent line */}
            <div className="h-[3px] bg-gradient-to-r from-primary via-primary/50 to-transparent" />
          </div>

          {/* ── Blog section ── */}
          {blogPosts.length > 0 && (
            <section className="mt-10" aria-label={`Blog ${niche.name}`}>
              {/* Section header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-[site-red] rounded-full" />
                  <BookOpen className="size-4 text-[site-red]" />
                  <h2 className="font-bold text-base text-ink">
                    Bài viết về {niche.name}
                  </h2>
                </div>
                <Link
                  href={`/${niche.id}/blog`}
                  className="font-mono text-xs text-[site-red] hover:text-[#8f1200] flex items-center gap-1 transition-colors group"
                >
                  Tất cả bài
                  <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {blogPosts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/${niche.id}/blog/${post.slug}`}
                    className="group flex flex-col"
                  >
                  <div className="flex flex-col flex-1 bg-white border border-site-sand transition-all duration-200 hover:border-[color-mix(in_oklab,var(--ring)_50%,transparent)] hover:shadow-[0_4px_20px_color-mix(in_oklab,var(--ring)_12%,transparent)]">
                    {/* Cover image (only if available) */}
                    {post.coverImage && (
                      <div className="relative aspect-[16/9] overflow-hidden border-b border-site-sand">
                        <img
                          src={post.coverImage}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                        <span className="absolute bottom-2 right-2 font-mono text-[10px] text-white bg-black/40 px-1.5 py-0.5">
                          {post.readTime} phút đọc
                        </span>
                      </div>
                    )}

                    <div className="flex-1 flex flex-col p-3.5 gap-2">
                      {/* Title */}
                      <p className="font-mono text-[13px] font-bold text-site-ink leading-snug line-clamp-2 group-hover:text-[color-mix(in_oklab,var(--ring)_80%,var(--color-site-ink))] transition-colors">
                        {post.title}
                      </p>

                      {/* Description */}
                      {post.description && (
                        <p className="font-mono text-[11px] text-site-ink/55 line-clamp-2 leading-relaxed">
                          {post.description}
                        </p>
                      )}

                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="font-mono text-[9px] uppercase tracking-wide text-site-brown border border-site-brown/25 px-1.5 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer row */}
                      <div className="mt-auto pt-2 flex items-center justify-between border-t border-site-sand">
                        <time className="font-mono text-[10px] text-site-ink/35">
                          {new Date(post.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </time>
                        <span className="font-mono text-[10px] text-site-ink/40 group-hover:text-[color-mix(in_oklab,var(--ring)_80%,transparent)] group-hover:underline transition-colors">
                          Đọc thêm →
                        </span>
                      </div>
                    </div>
                  </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── SEO footer block ── */}
          <div className="mt-10 grid sm:grid-cols-3 gap-px bg-border-color border border-border-color">
            {[
              { label: "Nguồn dữ liệu", text: `Shopee, Lazada, KingFoodMart và hơn 50 thương hiệu ${niche.name.toLowerCase()}` },
              { label: "Tần suất cập nhật", text: "Tự động mỗi 4 giờ — deal hết hạn bị xóa trong 24h" },
              { label: "Lịch sử giá", text: "Biểu đồ 30 ngày giúp phát hiện \"sale ảo\" trước khi mua" },
            ].map(({ label, text }) => (
              <div key={label} className="bg-[site-cream] px-4 py-3">
                <p className="font-mono text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-1">{label}</p>
                <p className="font-mono text-xs text-ink/60 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </main>
      </div>

      <Footer />
    </>
  )
}

export default function NichePageClient(props: Props) {
  return (
    <Suspense>
      <NicheContent {...props} />
    </Suspense>
  )
}
