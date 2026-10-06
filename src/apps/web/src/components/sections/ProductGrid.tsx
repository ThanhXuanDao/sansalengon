"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpDown, ArrowUp, ArrowDown, Star, ChevronDown } from "lucide-react"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"
import EmptyState from "@/components/ui/EmptyState"
import FilterBar from "./FilterBar"
import type { SortOption } from "./FilterBar"
import type { Product, Category } from "@/types"
import type { SyncSourcePublic } from "@/hooks/useSources"
import { toSourceItems, toCategoryItems } from "@/lib/filter-utils"
import { useCouponCounts } from "@/hooks/useCouponCounts"

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

const sortOptions: SortOption[] = [
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
  const couponCounts = useCouponCounts()

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
      <FilterBar
        sources={sources ? toSourceItems(sources) : undefined}
        activeSources={activeSources}
        onSourceToggle={onSourceChange}
        isSourcesLoading={isSourcesLoading}

        categories={categories ? toCategoryItems(categories) : undefined}
        activeCategories={activeSlugs}
        onCategoryToggle={onCategoryChange}
        isCategoriesLoading={isCategoriesLoading}

        sortOptions={onSortChange ? sortOptions : undefined}
        sort={sort}
        onSortChange={onSortChange}
      />

      {/* ── Product grid ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-4"
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
            : allProducts.map((product, i) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} onBuy={onBuyProduct} couponCount={couponCounts[product.source] ?? 0} priority={i < 4} />
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
