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
  visible: {
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
}

const SKELETON_COUNT = 8

const sortOptions = [
  { value: "number_asc", label: "Nomor" },
  { value: "newest", label: "Terbaru" },
  { value: "price_asc", label: "Termurah" },
  { value: "price_desc", label: "Termahal" },
  { value: "rating_desc", label: "Rating" },
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
        <p className="text-destructive">
          Gagal memuat produk. Coba refresh halaman.
        </p>
      </div>
    )
  }

  return (
      <div className="flex-grow" aria-live="polite">
        <div className="mb-12">
        <div className="flex items-center gap-4 mb-6 border-b border-dashed border-border-color pb-4">
          <h2 className="text-headline-md text-ink uppercase tracking-tight font-sans text-pretty">
            Rekomendasi Hari Ini
          </h2>
          <span className="bg-tag-yellow px-2 py-1 font-mono text-xs font-bold border border-ink">
            HOT DEALS
          </span>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
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
                  <ProductCard
                    product={product}
                    variant="highlight"
                    onBuy={onBuyProduct}
                  />
                </motion.div>
              ))}
        </motion.div>
      </div>

      <div className="flex items-center justify-between mb-6 border-b border-dashed border-border-color pb-4">
        <h2 className="text-headline-md text-ink uppercase tracking-tight font-sans text-pretty">
          Semua Produk
        </h2>
        <div className="flex items-center gap-3">
          {onSortChange && (
            <div className="hidden sm:flex items-center gap-1 bg-white border border-border-color rounded-full p-0.5">
              {sortOptions.map((opt) => {
                const isActive = sort === opt.value
                const Icon =
                  opt.value === "price_asc"
                    ? ArrowUp
                    : opt.value === "price_desc"
                      ? ArrowDown
                      : opt.value === "rating_desc"
                        ? Star
                        : ArrowUpDown
                return (
                  <button
                    key={opt.value}
                    onClick={() => onSortChange(opt.value)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono uppercase transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? "bg-ink text-white"
                        : "text-ink/50 hover:text-ink"
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
            {isLoading ? "…" : `${total}`} items
          </span>
        </div>
      </div>

      {/* Mobile sort */}
      {onSortChange && (
        <div className="flex sm:hidden gap-1 mb-4 overflow-x-auto">
          {sortOptions.map((opt) => {
            const isActive = sort === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-mono uppercase border transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-ink text-white border-ink"
                    : "bg-white text-ink/50 border-border-color"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile category + number range chips */}
      <div className="md:hidden space-y-2 mb-4">
        {isCategoriesLoading ? (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sk-cat-${i}`} className="h-8 skeleton-shimmer rounded-full shrink-0" style={{ width: `${70 + i * 20}px` }} />
            ))}
          </div>
        ) : (
          <>
            {categories && categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Kategori produk">
                {categories.map((cat) => {
                  const isActive = cat.slug === activeSlug
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onCategoryChange?.(cat.slug)}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-tag-yellow text-ink font-bold border-ink"
                          : "bg-white text-ink/60 border-border-color hover:border-ink/30"
                      }`}
                    >
                      <CategoryIcon icon={cat.icon} className="size-3.5" />
                      <span>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {numberRanges !== undefined && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => onRangeSelect?.(null)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                    !activeRange
                      ? "bg-tag-yellow text-ink font-bold border-ink"
                      : "bg-white text-ink/60 border-border-color hover:border-ink/30"
                  }`}
                >
                  Semua
                </button>
                {numberRanges.map((range) => {
                  const isActive = activeRange?.from === range.from && activeRange?.to === range.to
                  return (
                    <button
                      key={range.label}
                      onClick={() => onRangeSelect?.(isActive ? null : range)}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-tag-yellow text-ink font-bold border-ink"
                          : "bg-white text-ink/60 border-border-color hover:border-ink/30"
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

      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial={prefersReducedMotion ? undefined : "hidden"}
        animate={prefersReducedMotion ? undefined : "visible"}
      >
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <ProductCardSkeleton key={`s-all-${i}`} />
            ))
          : allProducts.length === 0
            ? (
            <EmptyState
              categoryName={activeCategory?.name}
              onReset={onResetCategory}
            />
              )
            : allProducts.map((product) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard
                    product={product}
                    variant="compact"
                    onBuy={onBuyProduct}
                  />
                </motion.div>
              ))}
      </motion.div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadMoreLoading}
            className="bg-transparent border-2 border-ink text-ink px-6 py-2 font-bold text-sm uppercase tracking-wider hover:bg-ink hover:text-white transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isLoadMoreLoading ? "Memuat…" : "Muat Lebih Banyak"}
          </button>
        </div>
      )}
    </div>
  )
}
