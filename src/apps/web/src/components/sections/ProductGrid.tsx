"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpDown, ArrowUp, ArrowDown, Star, ChevronDown } from "lucide-react"
import Image from "next/image"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"
import EmptyState from "@/components/ui/EmptyState"
import type { Product, Category } from "@/types"
import type { SyncSourcePublic } from "@/hooks/useSources"

interface ProductGridProps {
  allProducts?: Product[]
  total?: number
  isLoading?: boolean
  error?: string
  onResetCategory?: () => void
  onBuyProduct?: (productId: string) => void
  sort?: string
  onSortChange?: (sort: string) => void
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadMoreLoading?: boolean
  categories?: Category[]
  activeSlugs?: string[]
  onCategoryChange?: (slug: string) => void
  isCategoriesLoading?: boolean
  sources?: SyncSourcePublic[]
  activeSources?: string[]
  onSourceChange?: (slug: string) => void
  isSourcesLoading?: boolean
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
}

const SKELETON_COUNT = 10

const sortOptions = [
  { value: "discount_desc", label: "Giảm nhiều nhất", Icon: ArrowUpDown },
  { value: "newest",        label: "Mới nhất",        Icon: ArrowUpDown },
  { value: "price_asc",     label: "Rẻ nhất",         Icon: ArrowUp },
  { value: "price_desc",    label: "Đắt nhất",        Icon: ArrowDown },
  { value: "rating_desc",   label: "Đánh giá",        Icon: Star },
]

export default function ProductGrid({
  allProducts = [],
  total = 0,
  isLoading,
  error,
  onResetCategory,
  onBuyProduct,
  sort = "discount_desc",
  onSortChange,
  hasMore,
  onLoadMore,
  isLoadMoreLoading,
  categories,
  activeSlugs = [],
  onCategoryChange,
  isCategoriesLoading,
  sources,
  activeSources = [],
  onSourceChange,
  isSourcesLoading,
}: ProductGridProps) {
  const prefersReducedMotion = useReducedMotion()

  if (error) {
    return (
      <div className="flex items-center justify-center py-16" role="alert">
        <p className="text-destructive">Không tải được sản phẩm. Hãy refresh trang.</p>
      </div>
    )
  }

  return (
    <div aria-live="polite">

      {/* ── Heading ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <h2 className="font-sans font-extrabold text-lg text-ink tracking-tight">
          🏷️ Tất cả sản phẩm
        </h2>
        <p className="font-mono text-xs text-ink/50 mt-0.5">
          {total > 0 ? `${total} sản phẩm đang giảm giá` : "Lọc và sắp xếp sản phẩm theo nhu cầu"}
        </p>
      </div>

      {/* ── Filter + Sort toolbar ───────────────────────────────── */}
      <div className="sticky top-[114px] sm:top-[142px] z-40 -mx-3 px-3 bg-white pt-3 pb-4 mb-6 border-b border-[#e5e1d8]">

        {/* Row 0: Source filter pills */}
        {(isSourcesLoading || (sources && sources.length > 0)) && (
          <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Nguồn">
            {isSourcesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[60px] h-[60px] rounded-full skeleton-shimmer shrink-0" />
                ))
              : sources?.map((src) => {
                  const isActive = activeSources.includes(src.slug)
                  return (
                    <button
                      key={src.slug}
                      onClick={() => onSourceChange?.(src.slug)}
                      aria-pressed={isActive}
                      title={src.name}
                      className={`flex items-center justify-center w-[60px] h-[60px] rounded-full border-2 transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-filter-active overflow-hidden ${
                        isActive
                          ? "bg-filter-active/10 border-filter-active"
                          : "border-border-color hover:border-filter-active/50 bg-white"
                      }`}
                    >
                      {src.icon ? (
                        <Image
                          src={src.icon}
                          alt={src.name}
                          width={40}
                          height={40}
                          className="object-contain w-[40px] h-[40px]"
                          unoptimized
                        />
                      ) : (
                        <span className="font-bold text-[18px] text-ink/60 select-none">
                          {src.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </button>
                  )
                })}
          </div>
        )}

        {/* Row 1: Category icon pills */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Danh mục">
          {isCategoriesLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-[60px] h-[60px] rounded-full skeleton-shimmer shrink-0" />
              ))
            : categories?.map((cat) => {
                const isActive = activeSlugs.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange?.(cat.id)}
                    aria-pressed={isActive}
                    title={cat.name}
                    className={`flex items-center justify-center w-[60px] h-[60px] rounded-full border-2 transition-all shrink-0 text-[28px] focus-visible:ring-2 focus-visible:ring-filter-active ${
                      isActive
                        ? "bg-filter-active/10 border-filter-active"
                        : "bg-white border-border-color hover:border-filter-active/50"
                    }`}
                  >
                    <span aria-hidden="true">{cat.emoji}</span>
                  </button>
                )
              })}
        </div>

        {/* Row 2: Sort pills */}
        {onSortChange && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" role="toolbar" aria-label="Sắp xếp">
            {sortOptions.map(({ value, label, Icon }) => {
              const isActive = sort === value
              return (
                <button
                  key={value}
                  onClick={() => onSortChange(value)}
                  className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-filter-active ${
                    isActive
                      ? "bg-filter-active/10 text-filter-active border-filter-active font-bold"
                      : "bg-white text-ink/50 border-border-color hover:border-filter-active/50 hover:text-ink"
                  }`}
                >
                  <Icon className="size-3" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Product grid ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial={prefersReducedMotion ? undefined : "hidden"}
        animate={prefersReducedMotion ? undefined : "visible"}
      >
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <ProductCardSkeleton key={`s-all-${i}`} />
            ))
          : allProducts.length === 0
            ? <EmptyState onReset={onResetCategory} />
            : allProducts.map((product) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} onBuy={onBuyProduct} />
                </motion.div>
              ))}
      </motion.div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadMoreLoading}
            className="flex items-center gap-3 bg-primary hover:brightness-90 text-white px-10 py-3 rounded-full font-semibold text-sm transition-all active:scale-[.97] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer min-w-[200px] justify-center"
          >
            {isLoadMoreLoading ? (
              <>
                <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" aria-hidden="true" />
                Đang tải…
              </>
            ) : (
              <>
                Xem thêm
                <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
