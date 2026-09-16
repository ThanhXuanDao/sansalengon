"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpDown, ArrowUp, ArrowDown, Star } from "lucide-react"
import CategoryIcon from "@/components/ui/CategoryIcon"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"
import EmptyState from "@/components/ui/EmptyState"
import type { Product, Category } from "@/types"

interface ProductGridProps {
  featuredProducts?: Product[]
  allProducts?: Product[]
  total?: number
  isLoading?: boolean
  isFeaturedLoading?: boolean
  error?: string
  activeCategory?: Category
  onResetCategory?: () => void
  onBuyProduct?: (productId: string, shopeeUrl: string) => void
  sort?: string
  onSortChange?: (sort: string) => void
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadMoreLoading?: boolean
  categories?: Category[]
  activeSlug?: string
  onCategoryChange?: (slug: string) => void
  numberRanges?: { label: string; from: number; to: number }[]
  activeRange?: { from: number; to: number } | null
  onRangeSelect?: (range: { from: number; to: number } | null) => void
  isCategoriesLoading?: boolean
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
}

const SKELETON_COUNT = 8

const sortOptions = [
  { value: "discount_desc", label: "Giảm nhiều nhất" },
  { value: "number_asc", label: "Số" },
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Rẻ nhất" },
  { value: "price_desc", label: "Đắt nhất" },
  { value: "rating_desc", label: "Đánh giá" },
]

export default function ProductGrid({
  featuredProducts = [],
  allProducts = [],
  total = 0,
  isLoading,
  isFeaturedLoading,
  error,
  activeCategory,
  onResetCategory,
  onBuyProduct,
  sort = "newest",
  onSortChange,
  hasMore,
  onLoadMore,
  isLoadMoreLoading,
  categories,
  activeSlug = "semua",
  onCategoryChange,
  numberRanges,
  activeRange,
  onRangeSelect,
  isCategoriesLoading,
}: ProductGridProps) {
  const prefersReducedMotion = useReducedMotion()

  if (error) {
    return (
      <div className="flex-grow flex items-center justify-center py-16" role="alert">
        <p className="text-destructive">Không tải được sản phẩm. Hãy refresh trang.</p>
      </div>
    )
  }

  return (
    <div className="flex-grow" aria-live="polite">

      {/* ── Featured section ───────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4 border-b border-dashed border-border-color pb-4">
          <h2 className="text-headline-md text-ink uppercase tracking-tight font-sans text-pretty">
            Đề xuất hôm nay
          </h2>
          <span className="bg-tag-yellow px-2 py-1 font-mono text-xs font-bold border border-ink">
            HOT DEALS
          </span>
        </div>

        {/* Desktop: 3-col grid */}
        <motion.div
          className="hidden md:grid grid-cols-3 gap-6"
          variants={prefersReducedMotion ? undefined : containerVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "visible"}
        >
          {isFeaturedLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <ProductCardSkeleton key={`s-feat-${i}`} variant="highlight" />
              ))
            : featuredProducts.map((product) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} variant="highlight" onBuy={onBuyProduct} />
                </motion.div>
              ))}
        </motion.div>

        {/* Mobile: horizontal scroll strip */}
        <div className="md:hidden -mx-4">
          {isFeaturedLoading ? (
            <div className="flex gap-3 px-4 overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`s-feat-m-${i}`} className="shrink-0 w-44">
                  <ProductCardSkeleton variant="highlight" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex gap-3 px-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
            >
              {featuredProducts.map((product) => (
                <div key={product.id} className="shrink-0 w-44 snap-start">
                  <ProductCard product={product} variant="highlight" onBuy={onBuyProduct} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── All products header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 border-b border-dashed border-border-color pb-4">
        <h2 className="text-headline-md text-ink uppercase tracking-tight font-sans text-pretty">
          Tất cả sản phẩm
        </h2>
        <div className="flex items-center gap-3">
          {/* Desktop sort pills */}
          {onSortChange && (
            <div className="hidden sm:flex items-center gap-1 bg-white border border-border-color rounded-full p-0.5">
              {sortOptions.map((opt) => {
                const isActive = sort === opt.value
                const Icon =
                  opt.value === "price_asc" ? ArrowUp
                  : opt.value === "price_desc" ? ArrowDown
                  : opt.value === "rating_desc" ? Star
                  : ArrowUpDown
                return (
                  <button
                    key={opt.value}
                    onClick={() => onSortChange(opt.value)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono uppercase transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive ? "bg-ink text-white" : "text-ink/50 hover:text-ink"
                    }`}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}
          <span className="font-mono text-sm text-ink/60">
            {isLoading ? "…" : `${total}`} sản phẩm
          </span>
        </div>
      </div>

      {/* ── Mobile sticky filter bar ────────────────────────────── */}
      {/* Stays visible as user scrolls through products */}
      <div className="md:hidden sticky top-[64px] z-30 -mx-4 bg-white/95 backdrop-blur-sm border-b border-border-color mb-4">
        {/* Sort row */}
        {onSortChange && (
          <div
            className="flex gap-1.5 px-4 pt-2 pb-1 overflow-x-auto scrollbar-hide"
            role="toolbar"
            aria-label="Sắp xếp"
          >
            {sortOptions.map((opt) => {
              const isActive = sort === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive ? "bg-ink text-white border-ink" : "bg-white text-ink/50 border-border-color"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Category chips row */}
        {isCategoriesLoading ? (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sk-cat-${i}`} className="h-7 skeleton-shimmer rounded-full shrink-0" style={{ width: `${70 + i * 20}px` }} />
            ))}
          </div>
        ) : (
          <>
            {categories && categories.length > 0 && (
              <div
                className="flex gap-1.5 px-4 pb-1 overflow-x-auto scrollbar-hide"
                role="tablist"
                aria-label="Danh mục sản phẩm"
              >
                {categories.map((cat) => {
                  const isActive = cat.slug === activeSlug
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onCategoryChange?.(cat.slug)}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-tag-yellow text-ink font-bold border-ink"
                          : "bg-white text-ink/60 border-border-color"
                      }`}
                    >
                      <CategoryIcon icon={cat.icon} className="size-3" />
                      <span>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {numberRanges !== undefined && (
              <div
                className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide"
              >
                <button
                  onClick={() => onRangeSelect?.(null)}
                  className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 ${
                    !activeRange ? "bg-tag-yellow text-ink font-bold border-ink" : "bg-white text-ink/60 border-border-color"
                  }`}
                >
                  Tất cả
                </button>
                {numberRanges.map((range) => {
                  const isActive = activeRange?.from === range.from && activeRange?.to === range.to
                  return (
                    <button
                      key={range.label}
                      onClick={() => onRangeSelect?.(isActive ? null : range)}
                      className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 ${
                        isActive ? "bg-tag-yellow text-ink font-bold border-ink" : "bg-white text-ink/60 border-border-color"
                      }`}
                    >
                      {range.label}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Product grid ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial={prefersReducedMotion ? undefined : "hidden"}
        animate={prefersReducedMotion ? undefined : "visible"}
      >
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <ProductCardSkeleton key={`s-all-${i}`} />
            ))
          : allProducts.length === 0
            ? <EmptyState categoryName={activeCategory?.name} onReset={onResetCategory} />
            : allProducts.map((product) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} variant="compact" onBuy={onBuyProduct} />
                </motion.div>
              ))}
      </motion.div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadMoreLoading}
            className="bg-transparent border-2 border-ink text-ink px-6 py-3 font-bold text-sm uppercase tracking-wider hover:bg-ink hover:text-white active:scale-95 transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isLoadMoreLoading ? "Đang tải…" : "Xem thêm"}
          </button>
        </div>
      )}
    </div>
  )
}
